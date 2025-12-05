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

echo "🔧 Creating/Updating superadmin user '$EMAIL'..."

# Ensure pgcrypto is available
docker compose exec -T db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\" WITH SCHEMA extensions;"

docker compose exec -T db psql -U postgres -d postgres -c "
DO \$\$
DECLARE
    target_email TEXT := '$EMAIL';
    target_password TEXT := '$PASSWORD';
    target_uid UUID;
    encrypted_pw TEXT;
BEGIN
    -- Generate hashed password
    encrypted_pw := crypt(target_password, gen_salt('bf'));
    
    -- Check if user exists
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;
    
    IF target_uid IS NOT NULL THEN
        -- Update existing user password and confirm email
        UPDATE auth.users 
        SET encrypted_password = encrypted_pw, 
            email_confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = target_uid;
        
        RAISE NOTICE '✅ User % exists. Password updated.', target_email;
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
            is_super_admin
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
            false -- is_super_admin column in auth.users is usually for Supabase internal admin, but we use public.user_profiles
        );
        
        RAISE NOTICE '✅ Created new user % (ID: %)', target_email, target_uid;
        
        -- Insert into identities
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        )
        VALUES (
            target_uid,
            target_uid,
            format('{\"sub\": \"%s\", \"email\": \"%s\"}', target_uid, target_email)::jsonb,
            'email',
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
"
