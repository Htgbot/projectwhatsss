
-- Insert superadmin into auth.users
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
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'superadmin@test.com',
    extensions.crypt('superadmin123', extensions.gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"display_name": "Super Admin"}',
    now(),
    now()
) ON CONFLICT (id) DO NOTHING;

-- Insert superadmin into public.user_profiles
INSERT INTO public.user_profiles (id, email, display_name, role, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'superadmin@test.com',
    'Super Admin',
    'superadmin',
    'active'
) ON CONFLICT (id) DO UPDATE SET role = 'superadmin';
