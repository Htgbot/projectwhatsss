#!/bin/bash
# Manually Create Super Admin User (Bypassing API)
# Usage: ./scripts/manual_insert_user.sh <email> '<password>'

EMAIL=$1
PASSWORD=$2

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  echo "Usage: ./scripts/manual_insert_user.sh <email> '<password>'"
  echo "⚠️  IMPORTANT: Wrap your password in single quotes if it contains special characters!"
  echo "Example: ./scripts/manual_insert_user.sh info@htgsuper.com 'my&super#pass'"
  exit 1
fi

# Escape single quotes for SQL to prevent syntax errors
SAFE_PASSWORD="${PASSWORD//\'/''}"

echo "🚀 Manually creating/updating Super Admin user: $EMAIL"

# 1. Fix pgcrypto by removing the blocking script
# The previous fix attempt created a file that Postgres can't read, causing the permission error.
# We must remove it to allow the extension creation to proceed (or skip the hook gracefully).
echo "   - Cleaning up conflicting custom scripts..."
docker compose exec -T db bash -c "rm -f /etc/postgresql-custom/extension-custom-scripts/before-create.sql"

# 2. Ensure pgcrypto is installed
echo "   - Ensuring pgcrypto extension..."
# We use 'extensions' schema which is standard for Supabase
docker compose exec -T db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\" SCHEMA extensions;"

# 3. Insert the User
echo "   - Inserting user into database..."

docker compose exec -T db psql -U postgres -d postgres -c "
DO \$\$
DECLARE
  user_id uuid := gen_random_uuid();
  encrypted_pw text;
BEGIN
  -- Generate Hash using pgcrypto with cost 10 (standard for Supabase)
  encrypted_pw := crypt('$SAFE_PASSWORD', gen_salt('bf', 10));

  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = '$EMAIL') THEN
    RAISE NOTICE 'User % already exists. Updating password and role...', '$EMAIL';
    
    -- Update existing user
    UPDATE auth.users 
    SET encrypted_password = encrypted_pw,
        email_confirmed_at = now(),
        raw_user_meta_data = '{\"display_name\": \"Super Admin\"}',
        raw_app_meta_data = '{\"provider\": \"email\", \"providers\": [\"email\"]}',
        is_super_admin = true,
        role = 'authenticated'
    WHERE email = '$EMAIL'
    RETURNING id INTO user_id;
    
  ELSE
    -- Insert User into auth.users
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, 
      email_confirmed_at, recovery_sent_at, last_sign_in_at, 
      raw_app_meta_data, raw_user_meta_data, 
      created_at, updated_at, confirmation_token, email_change, 
      email_change_token_new, recovery_token, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', user_id, 'authenticated', 'authenticated', '$EMAIL', encrypted_pw, 
      now(), now(), now(), 
      '{\"provider\": \"email\", \"providers\": [\"email\"]}', '{\"display_name\": \"Super Admin\"}', 
      now(), now(), '', '', '', '', true
    );
    
    -- Insert Identity (Crucial for Supabase Auth to work)
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      user_id, user_id, format('{\"sub\": \"%s\", \"email\": \"%s\"}', user_id, '$EMAIL')::jsonb, 'email', now(), now(), now()
    );
  END IF;

  -- Ensure Profile Exists (Manual fallback if trigger failed)
  INSERT INTO public.user_profiles (id, email, role, status)
  VALUES (user_id, '$EMAIL', 'superadmin', 'active')
  ON CONFLICT (id) DO UPDATE SET role = 'superadmin', status = 'active';

  RAISE NOTICE '✅ SUCCESS: User % created/updated with ID: %', '$EMAIL', user_id;
END
\$\$;
"

echo "🎉 Done! You can now log in with these credentials."
