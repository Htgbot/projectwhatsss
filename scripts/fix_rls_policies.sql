-- Fix Infinite Recursion in RLS Policies by using SECURITY DEFINER functions

-- Function to get current user's role without triggering RLS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

-- Function to get current user's company_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- Drop existing recursive policies
DROP POLICY IF EXISTS "Superadmin all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin view company profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin manage company workers" ON public.user_profiles;
-- Also drop these if they exist to be safe, though they weren't recursive in the list, but we want to be consistent
DROP POLICY IF EXISTS "Self view profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Self update profile" ON public.user_profiles;


-- Re-create policies using the helper functions

-- Superadmin can do everything
CREATE POLICY "Superadmin all profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (
  get_my_role() = 'superadmin'
);

-- Admin can view profiles in their company
CREATE POLICY "Admin view company profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  company_id = get_my_company_id()
);

-- Admin can manage workers in their company (create/update/delete)
-- Note: The original policy had a check for 'worker' role in the target row.
CREATE POLICY "Admin manage company workers"
ON public.user_profiles
FOR ALL
TO authenticated
USING (
  get_my_role() = 'admin' AND 
  company_id = get_my_company_id() AND
  role = 'worker'
)
WITH CHECK (
  get_my_role() = 'admin' AND 
  company_id = get_my_company_id() AND
  role = 'worker'
);

-- Users can view their own profile (always allowed)
CREATE POLICY "Self view profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
);

-- Users can update their own profile
CREATE POLICY "Self update profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
)
WITH CHECK (
  id = auth.uid()
);
