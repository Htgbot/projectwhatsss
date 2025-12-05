#!/bin/bash

# Create Superadmin Script
# Usage: ./scripts/create_superadmin.sh <email> <password>

EMAIL=$1
PASSWORD=$2

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  echo "❌ Usage: ./scripts/create_superadmin.sh <email> <password>"
  echo "   Example: ./scripts/create_superadmin.sh admin@example.com 'mysecurepassword123!'"
  echo "   ⚠️  NOTE: If your password contains special characters (like &, #, !, $), wrap it in single quotes!"
  exit 1
fi

# Escape single quotes for SQL ( ' becomes '' )
# This handles passwords like "don't" becoming "don''t" which is valid SQL
SAFE_EMAIL=${EMAIL//\'/\'\'}
SAFE_PASSWORD=${PASSWORD//\'/\'\'}

echo "🔧 Creating/Updating superadmin user '$EMAIL'..."

# Check if pgcrypto exists to avoid permission errors on re-creation attempts
EXTENSION_EXISTS=$(docker compose exec -T db psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'")

if [ "$EXTENSION_EXISTS" != "1" ]; then
    echo "⚠️ pgcrypto extension not found. Attempting to create..."
    docker compose exec -T db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\" WITH SCHEMA extensions;"
else
    echo "✅ pgcrypto extension verified."
fi

# Execute the PL/pgSQL block using a Here-Document passed to stdin.
# This avoids shell quoting issues with JSON strings.
docker compose exec -T db psql -U postgres -d postgres <<EOF
DO \$\$
DECLARE
    target_email TEXT := '$SAFE_EMAIL';
    target_password TEXT := '$SAFE_PASSWORD';
    target_uid UUID;
    encrypted_pw TEXT;
BEGIN
    -- Generate hashed password using explicit schema
    encrypted_pw := extensions.crypt(target_password, extensions.gen_salt('bf', 10));
    
    -- Check if user exists
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;
    
    IF target_uid IS NOT NULL THEN
        -- Update existing user password and confirm email
        UPDATE auth.users 
        SET encrypted_password = encrypted_pw, 
            email_confirmed_at = NOW(),
            updated_at = NOW(),
            raw_app_meta_data = '{"provider":"email","providers":["email"]}',
            raw_user_meta_data = '{}'
        WHERE id = target_uid;
        
        -- Ensure identity exists (fixes cases where previous insert failed)
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        )
        VALUES (
            target_uid,
            target_uid,
            format('{"sub": "%s", "email": "%s"}', target_uid, target_email)::jsonb,
            'email',
            target_uid::text,
            NOW(),
            NOW(),
            NOW()
        )
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE '✅ User % exists. Password updated (and identity verified).', target_email;
    ELSE
        -- Create new user
        target_uid := gen_random_uuid();
        
        INSERT INTO auth.users (
            id, 
            instance_id, 
            aud, 
            role, 
            email, 
            encrypted_password, 
            email_confirmed_at, 
            created_at, 
            updated_at,
            confirmation_token,
            recovery_token,
            is_super_admin,
            raw_app_meta_data,
            raw_user_meta_data
        )
        VALUES (
            target_uid, 
            '00000000-0000-0000-0000-000000000000', 
            'authenticated', 
            'authenticated', 
            target_email, 
            encrypted_pw, 
            NOW(), 
            NOW(), 
            NOW(),
            '',
            '',
            false, -- is_super_admin column in auth.users is usually for Supabase internal admin, but we use public.user_profiles
            '{"provider":"email","providers":["email"]}',
            '{}'
        );
        
        RAISE NOTICE '✅ Created new user % (ID: %)', target_email, target_uid;
        
        -- Insert into identities
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        )
        VALUES (
            target_uid,
            target_uid,
            format('{"sub": "%s", "email": "%s"}', target_uid, target_email)::jsonb,
            'email',
            target_uid::text,
            NOW(),
            NOW(),
            NOW()
        );
    END IF;

    -- Assign Superadmin Role in public.user_profiles
    INSERT INTO public.user_profiles (id, email, role, status)
    VALUES (target_uid, target_email, 'superadmin', 'active')
    ON CONFLICT (id) DO UPDATE
    SET role = 'superadmin', status = 'active', email = target_email;
    
    RAISE NOTICE '✅ User % promoted to superadmin in user_profiles.', target_email;
END \$\$;
EOF
