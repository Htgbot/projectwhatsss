#!/bin/bash

# big_fix_login.sh - Comprehensive fix for Login Issues
# Run this on the VPS

echo "==================================================="
echo "   STARTING BIG FIX FOR SUPABASE LOGIN"
echo "==================================================="

# 1. Ensure Docker Compose is running
if ! docker compose ps | grep -q "Up"; then
  echo "Docker Compose is not running. Starting it..."
  docker compose up -d
  sleep 10
fi

# 2. Fix Database User & Password
echo "--> Resetting Superadmin User in Database..."

docker compose exec -T db psql -U postgres -d postgres <<'EOSQL'
DO $$
DECLARE
  user_id uuid;
  encrypted_pw text;
  email_val text := 'info@htgsuper.com';
  password_val text := 'Admin12345';
BEGIN
  -- 1. Ensure pgcrypto extension exists
  CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;

  -- 2. Generate Hash (bcrypt cost 10)
  encrypted_pw := crypt(password_val, gen_salt('bf', 10));

  -- 3. Check if user exists
  SELECT id INTO user_id FROM auth.users WHERE email = email_val;

  IF user_id IS NOT NULL THEN
    RAISE NOTICE 'Updating existing user %', email_val;
    UPDATE auth.users 
    SET encrypted_password = encrypted_pw,
        email_confirmed_at = now(),
        updated_at = now(),
        raw_app_meta_data = '{"provider": "email", "providers": ["email"]}',
        raw_user_meta_data = '{"display_name": "Super Admin"}',
        is_super_admin = true,
        role = 'authenticated',
        instance_id = '00000000-0000-0000-0000-000000000000'
    WHERE id = user_id;
  ELSE
    RAISE NOTICE 'Creating new user %', email_val;
    user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, 
      email_confirmed_at, recovery_sent_at, last_sign_in_at, 
      raw_app_meta_data, raw_user_meta_data, 
      created_at, updated_at, confirmation_token, email_change, 
      email_change_token_new, recovery_token, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', user_id, 'authenticated', 'authenticated', email_val, encrypted_pw, 
      now(), now(), now(), 
      '{"provider": "email", "providers": ["email"]}', '{"display_name": "Super Admin"}', 
      now(), now(), '', '', '', '', true
    );
    
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      user_id, user_id, format('{"sub": "%s", "email": "%s"}', user_id, email_val)::jsonb, 'email', now(), now(), now()
    );
  END IF;

  -- 4. Ensure Profile in public schema
  INSERT INTO public.user_profiles (id, email, role, status)
  VALUES (user_id, email_val, 'superadmin', 'active')
  ON CONFLICT (id) DO UPDATE SET role = 'superadmin', status = 'active';

  RAISE NOTICE 'SUCCESS: User updated with password: Admin12345';
END
$$;
EOSQL

if [ $? -eq 0 ]; then
    echo "--> Database update successful."
else
    echo "--> ERROR: Database update failed."
    exit 1
fi

# 3. Restart Auth Service to clear cache
echo "--> Restarting Auth Service (supabase-auth)..."
docker compose restart auth

# 4. Wait for Auth Service to be ready
echo "--> Waiting for Auth Service to be ready..."
sleep 5

# 5. Verify User Login (Optional Simulation or just Logs)
echo "==================================================="
echo "   BIG FIX COMPLETED"
echo "==================================================="
echo "Please try logging in with:"
echo "   Email:    info@htgsuper.com"
echo "   Password: Admin12345"
echo "==================================================="
