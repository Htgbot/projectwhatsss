#!/bin/bash
# Manually Create Super Admin User (Bypassing API)
# Usage: ./scripts/manual_insert_user.sh <email> <password>

EMAIL=$1
PASSWORD=$2

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  echo "Usage: ./scripts/manual_insert_user.sh <email> <password>"
  echo "Example: ./scripts/manual_insert_user.sh admin@example.com mysecurepassword"
  exit 1
fi

echo "🚀 Manually creating Super Admin user: $EMAIL"

# Check if pgcrypto is installed
PGCRYPTO_CHECK=$(docker compose exec -T db psql -U postgres -d postgres -tAc "SELECT count(*) FROM pg_extension WHERE extname = 'pgcrypto';")

if [ "$PGCRYPTO_CHECK" != "1" ]; then
  echo "⚠️  pgcrypto extension is MISSING. Attempting to install..."
  ./scripts/fix_pg_permissions.sh
fi

echo "   - Inserting user into database..."

docker compose exec -T db psql -U postgres -d postgres -c "
DO \$\$
DECLARE
  user_id uuid := gen_random_uuid();
  encrypted_pw text;
BEGIN
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = '$EMAIL') THEN
    RAISE NOTICE 'User % already exists. Updating password and role...', '$EMAIL';
    
    -- Update existing user
    UPDATE auth.users 
    SET encrypted_password = crypt('$PASSWORD', gen_salt('bf')),
        raw_user_meta_data = '{\"display_name\": \"Super Admin\"}'
    WHERE email = '$EMAIL'
    RETURNING id INTO user_id;
    
  ELSE
    -- Generate Hash using pgcrypto
    encrypted_pw := crypt('$PASSWORD', gen_salt('bf'));
  
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
