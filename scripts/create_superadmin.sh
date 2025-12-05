#!/bin/bash

# Create Superadmin Script
# Usage: ./scripts/create_superadmin.sh <email> [password]

EMAIL=$1
PASSWORD=$2

if [ -z "$EMAIL" ]; then
  echo "❌ Usage: ./scripts/create_superadmin.sh <email> [password]"
  echo "   Example: ./scripts/create_superadmin.sh admin@example.com"
  echo "   (You will be prompted for the password securely if not provided)"
  exit 1
fi

# Prompt for password if not provided
if [ -z "$PASSWORD" ]; then
    echo -n "🔑 Enter password for $EMAIL: "
    read -s PASSWORD
    echo ""
    echo -n "🔑 Confirm password: "
    read -s PASSWORD_CONFIRM
    echo ""

    if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
        echo "❌ Passwords do not match!"
        exit 1
    fi
fi

echo "🔧 Creating/Updating superadmin user '$EMAIL'..."

# Check if pgcrypto exists to avoid permission errors on re-creation attempts
EXTENSION_EXISTS=$(docker compose exec -T db psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'")

if [ "$EXTENSION_EXISTS" != "1" ]; then
    echo "⚠️ pgcrypto extension not found. Attempting to create..."
    docker compose exec -T db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\" WITH SCHEMA extensions;"
else
    echo "✅ pgcrypto extension verified."
fi

# Use a safe way to pass the password variable into the heredoc
# We export it as an environment variable for the docker exec command to access? 
# No, docker exec doesn't automatically pass host env vars unless specified.
# Instead, we will use a cleaner heredoc approach where we escape single quotes in the password if any.

# Escape single quotes in password for SQL literal
SAFE_PASSWORD=$(echo "$PASSWORD" | sed "s/'/''/g")
SAFE_EMAIL=$(echo "$EMAIL" | sed "s/'/''/g")

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
    -- Generate hashed password using explicit schema with cost 10 (GoTrue standard)
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
