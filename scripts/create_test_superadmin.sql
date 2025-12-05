-- Create a test superadmin user
DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT := 'superadmin@test.com';
    v_password TEXT := 'supersecret123';
BEGIN
    -- Check if user exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
        SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    ELSE
        v_user_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            v_email,
            extensions.crypt(v_password, extensions.gen_salt('bf')),
            now(),
            '{"provider": "email", "providers": ["email"]}',
            '{"display_name": "Super Admin"}',
            now(),
            now()
        );
    END IF;

    -- Upsert profile
    INSERT INTO public.user_profiles (id, email, display_name, role, status)
    VALUES (v_user_id, v_email, 'Super Admin', 'superadmin', 'active')
    ON CONFLICT (id) DO UPDATE
    SET role = 'superadmin', status = 'active';

END $$;
