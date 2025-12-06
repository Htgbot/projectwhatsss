#!/bin/bash
# Debug Superadmin Login on VPS

echo "🔍 Debugging Login Issues..."

docker compose exec -T db psql -U postgres -d postgres -c "
DO \$\$
DECLARE
  v_email text := 'info@htgsuper.com';
  v_pass text := '7j&EUScVCt1v#';
  v_user record;
  v_match boolean;
  v_instance_id uuid;
BEGIN
  RAISE NOTICE '--- DIAGNOSTICS START ---';

  -- 1. Check if user exists
  SELECT * INTO v_user FROM auth.users WHERE email = v_email;
  
  IF v_user.id IS NULL THEN
    RAISE NOTICE '❌ User % NOT FOUND in auth.users', v_email;
  ELSE
    RAISE NOTICE '✅ User found: % (ID: %)', v_email, v_user.id;
    RAISE NOTICE '   Role: %', v_user.role;
    RAISE NOTICE '   Instance ID: %', v_user.instance_id;
    RAISE NOTICE '   Confirmed At: %', v_user.email_confirmed_at;
    
    -- 2. Verify Password
    -- We use the stored hash as the salt to verify
    SELECT (v_user.encrypted_password = crypt(v_pass, v_user.encrypted_password)) INTO v_match;
    
    IF v_match THEN
      RAISE NOTICE '✅ Password verification SUCCESS inside DB.';
      RAISE NOTICE '   The password stored in DB matches ''7j&EUScVCt1v#''';
    ELSE
      RAISE NOTICE '❌ Password verification FAILED inside DB.';
      RAISE NOTICE '   Stored hash does NOT match the provided password.';
      RAISE NOTICE '   Stored Hash: %', v_user.encrypted_password;
    END IF;
  END IF;

  -- 3. Check Instance ID consistency
  -- Check if there are other users with different instance_ids
  SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
  RAISE NOTICE '   Sample Instance ID in DB: %', v_instance_id;

  RAISE NOTICE '--- DIAGNOSTICS END ---';
END
\$\$;
"
