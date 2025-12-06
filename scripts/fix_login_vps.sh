#!/bin/bash
# Run this on your VPS to fix the Superadmin login instantly

echo "Fixing Superadmin Login..."

# Ensure pgcrypto exists
docker compose exec -T db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\" SCHEMA extensions;"

docker compose exec -T db psql -U postgres -d postgres -c "
DO \$\$
DECLARE
  user_id uuid;
  encrypted_pw text;
  email_val text := 'info@htgsuper.com';
  password_val text := '7j&EUScVCt1v#';
BEGIN
  -- Generate Hash using pgcrypto with cost 10
  encrypted_pw := crypt(password_val, gen_salt('bf', 10));

  -- Check if user exists
  SELECT id INTO user_id FROM auth.users WHERE email = email_val;

  IF user_id IS NOT NULL THEN
    RAISE NOTICE 'Updating existing user %', email_val;
    UPDATE auth.users 
    SET encrypted_password = encrypted_pw,
        email_confirmed_at = now(),
        updated_at = now(),
        raw_app_meta_data = '{\"provider\": \"email\", \"providers\": [\"email\"]}',
        raw_user_meta_data = '{\"display_name\": \"Super Admin\"}',
        is_super_admin = true,
        role = 'authenticated'
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
      '{\"provider\": \"email\", \"providers\": [\"email\"]}', '{\"display_name\": \"Super Admin\"}', 
      now(), now(), '', '', '', '', true
    );
    
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      user_id, user_id, format('{\"sub\": \"%s\", \"email\": \"%s\"}', user_id, email_val)::jsonb, 'email', now(), now(), now()
    );
  END IF;

  -- Ensure Profile
  INSERT INTO public.user_profiles (id, email, role, status)
  VALUES (user_id, email_val, 'superadmin', 'active')
  ON CONFLICT (id) DO UPDATE SET role = 'superadmin', status = 'active';

  RAISE NOTICE 'DONE. Password reset to: 7j&EUScVCt1v#';
END
\$\$;
"
