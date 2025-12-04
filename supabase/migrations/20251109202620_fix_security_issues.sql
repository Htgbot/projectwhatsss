/*
  # Fix Security and Performance Issues

  1. Unused Indexes
    - Remove unused indexes that are not being utilized by queries:
      - idx_business_numbers_user_id
      - idx_conversations_business_number_id
      - idx_user_number_access_granted_by
      - idx_user_number_access_number_id
      - idx_user_number_access_user_id

  2. Multiple Permissive Policies
    - Fix user_profiles table having two permissive SELECT policies
    - Keep "Users can view own profile" which is more restrictive and includes super_admin access
    - Remove "Authenticated users can view all profiles" which is overly permissive

  3. Function Search Path
    - Fix create_super_admin_user function to use immutable search_path
    - Change from 'public, pg_temp' to proper pg_catalog references

  4. Security Notes
    - Leaked password protection must be enabled in Supabase Dashboard
    - This cannot be set via SQL migration
*/

-- =====================================================
-- 1. Remove Unused Indexes
-- =====================================================

DROP INDEX IF EXISTS public.idx_business_numbers_user_id;
DROP INDEX IF EXISTS public.idx_conversations_business_number_id;
DROP INDEX IF EXISTS public.idx_user_number_access_granted_by;
DROP INDEX IF EXISTS public.idx_user_number_access_number_id;
DROP INDEX IF EXISTS public.idx_user_number_access_user_id;

-- =====================================================
-- 2. Fix Multiple Permissive Policies on user_profiles
-- =====================================================

-- Drop the overly permissive policy that allows all authenticated users to view all profiles
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON user_profiles;

-- Keep only "Users can view own profile" which is more restrictive
-- This policy allows users to view their own profile OR if they're a super admin
-- Note: This policy already exists and is the correct one to keep

-- =====================================================
-- 3. Fix Function Search Path
-- =====================================================

-- Drop all versions of create_super_admin_user function
DROP FUNCTION IF EXISTS public.create_super_admin_user();
DROP FUNCTION IF EXISTS public.create_super_admin_user(text, text, text);

-- Recreate create_super_admin_user with immutable search_path
CREATE OR REPLACE FUNCTION public.create_super_admin_user(
  p_email text,
  p_password text,
  p_display_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_result json;
BEGIN
  -- This function should only be called during initial setup
  -- Check if any super admin already exists
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE role = 'super_admin') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'A super admin already exists'
    );
  END IF;

  -- Create auth user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    pg_catalog.gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    pg_catalog.now(),
    pg_catalog.json_build_object('display_name', p_display_name, 'role', 'super_admin'),
    pg_catalog.now(),
    pg_catalog.now(),
    '',
    ''
  ) RETURNING id INTO v_user_id;

  -- Create user profile
  INSERT INTO public.user_profiles (
    id,
    email,
    display_name,
    role,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_email,
    p_display_name,
    'super_admin',
    pg_catalog.now(),
    pg_catalog.now()
  );

  RETURN json_build_object(
    'success', true,
    'user_id', v_user_id,
    'message', 'Super admin created successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'message', SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION public.create_super_admin_user IS 'Creates initial super admin user. Can only be called once. Uses fully qualified function names for security.';

-- =====================================================
-- MANUAL STEPS REQUIRED
-- =====================================================

/*
  IMPORTANT: Leaked Password Protection

  This setting cannot be enabled via SQL migration.
  
  To enable leaked password protection:
  1. Go to Supabase Dashboard
  2. Navigate to Authentication → Settings
  3. Under "Security and Protection" section
  4. Enable "Leaked Password Protection"
  
  This will check passwords against the HaveIBeenPwned database to prevent
  users from using compromised passwords.
*/
