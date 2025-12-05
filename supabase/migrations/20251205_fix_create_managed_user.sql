-- Function to allow admins/superadmins to create users
-- Updated to use explicit extensions schema for pgcrypto functions
CREATE OR REPLACE FUNCTION public.create_managed_user(
    new_email TEXT,
    new_password TEXT,
    new_role TEXT,
    new_company_id UUID,
    new_display_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    new_user_id UUID;
    current_user_role TEXT;
    current_user_company_id UUID;
BEGIN
    -- Get current user's role and company
    SELECT role, company_id INTO current_user_role, current_user_company_id
    FROM public.user_profiles
    WHERE id = auth.uid();

    -- Permission checks
    IF current_user_role = 'superadmin' THEN
        -- Superadmin can create 'admin', 'worker', or 'superadmin'
        -- Can assign any company
    ELSIF current_user_role = 'admin' THEN
        -- Admin can only create 'worker'
        IF new_role != 'worker' THEN
            RAISE EXCEPTION 'Admins can only create workers.';
        END IF;
        -- Admin can only assign to their own company
        IF new_company_id IS NULL OR new_company_id != current_user_company_id THEN
            RAISE EXCEPTION 'Admins can only create users for their own company.';
        END IF;
    ELSE
        RAISE EXCEPTION 'Permission denied.';
    END IF;

    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = new_email) THEN
        RAISE EXCEPTION 'User with this email already exists.';
    END IF;

    -- Generate ID
    new_user_id := gen_random_uuid();

    -- Insert into auth.users
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
        new_user_id,
        'authenticated',
        'authenticated',
        new_email,
        extensions.crypt(new_password, extensions.gen_salt('bf')),
        now(),
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object('display_name', new_display_name),
        now(),
        now()
    );

    -- Upsert into public.user_profiles
    INSERT INTO public.user_profiles (id, email, display_name, role, company_id, status)
    VALUES (new_user_id, new_email, new_display_name, new_role, new_company_id, 'active')
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        company_id = EXCLUDED.company_id,
        display_name = EXCLUDED.display_name;

    RETURN new_user_id;
END;
$$;
