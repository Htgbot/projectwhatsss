CREATE OR REPLACE FUNCTION public.create_company_and_admin(
    p_company_name TEXT,
    p_admin_email TEXT,
    p_admin_password TEXT,
    p_admin_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_company_id UUID;
    v_admin_id UUID;
    v_current_role TEXT;
BEGIN
    -- Check permission
    SELECT role INTO v_current_role FROM public.user_profiles WHERE id = auth.uid();
    IF v_current_role != 'superadmin' THEN
        RAISE EXCEPTION 'Permission denied. Only Superadmins can create companies.';
    END IF;

    -- Create Company
    INSERT INTO public.companies (name, subscription_status)
    VALUES (p_company_name, 'active')
    RETURNING id INTO v_company_id;

    -- Create Admin User
    -- We call create_managed_user to handle the auth.users insertion and profile creation
    v_admin_id := public.create_managed_user(
        p_admin_email,
        p_admin_password,
        'admin',
        v_company_id,
        p_admin_name
    );

    RETURN jsonb_build_object(
        'company_id', v_company_id,
        'admin_id', v_admin_id
    );
END;
$$;
