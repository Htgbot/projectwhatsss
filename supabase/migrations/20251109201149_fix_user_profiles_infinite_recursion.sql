/*
  # Fix User Profiles Infinite Recursion

  1. Problem
    - User profiles RLS policies check user_profiles table within their own policies
    - This creates infinite recursion when querying user_profiles
    - Affects all queries including conversations and messages

  2. Solution
    - Create a helper function to check if user is super admin
    - Use app_metadata from JWT instead of querying user_profiles table
    - Update all policies to use the new pattern

  3. Changes
    - Create is_super_admin() helper function
    - Recreate user_profiles policies without self-referencing
    - Update other policies to use the helper function
*/

-- =====================================================
-- STEP 1: Create Helper Function for Super Admin Check
-- =====================================================

-- This function checks app_metadata from JWT token instead of querying user_profiles
-- This prevents infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT raw_app_meta_data->>'role' = 'super_admin'
     FROM auth.users
     WHERE id = auth.uid()),
    false
  );
$$;

-- =====================================================
-- STEP 2: Update handle_new_user to Set app_metadata
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  
  -- Update auth.users with role in app_metadata for faster RLS checks
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('role', COALESCE(NEW.raw_user_meta_data->>'role', 'user'))
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- STEP 3: Recreate User Profiles Policies (No Recursion)
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Super admins can create users" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Users can only view their own profile or super admins can view all
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = id OR
    is_super_admin()
  );

-- Only super admins can create new user profiles
CREATE POLICY "Super admins can create users"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

-- Users can update their own profile, super admins can update any
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = id OR
    is_super_admin()
  );

-- =====================================================
-- STEP 4: Update Other Policies to Use Helper Function
-- =====================================================

-- Business Numbers Policies
DROP POLICY IF EXISTS "Users can view accessible numbers" ON business_numbers;
DROP POLICY IF EXISTS "Users can update own numbers" ON business_numbers;
DROP POLICY IF EXISTS "Users can delete own numbers" ON business_numbers;

CREATE POLICY "Users can view accessible numbers"
  ON business_numbers FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM user_number_access una
      WHERE una.number_id = business_numbers.id
      AND una.user_id = (select auth.uid())
    ) OR
    is_super_admin()
  );

CREATE POLICY "Users can update own numbers"
  ON business_numbers FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = user_id OR
    is_super_admin()
  );

CREATE POLICY "Users can delete own numbers"
  ON business_numbers FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) = user_id OR
    is_super_admin()
  );

-- Conversations Policies
DROP POLICY IF EXISTS "Users can view accessible conversations" ON conversations;

CREATE POLICY "Users can view accessible conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_numbers bn
      WHERE bn.phone_number = conversations.from_number
      AND (
        bn.user_id = (select auth.uid()) OR
        EXISTS (
          SELECT 1 FROM user_number_access una
          WHERE una.number_id = bn.id
          AND una.user_id = (select auth.uid())
        ) OR
        is_super_admin()
      )
    )
  );

-- Messages Policies
DROP POLICY IF EXISTS "Users can view accessible messages" ON messages;

CREATE POLICY "Users can view accessible messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN business_numbers bn ON bn.phone_number = c.from_number
      WHERE c.id = messages.conversation_id
      AND (
        bn.user_id = (select auth.uid()) OR
        EXISTS (
          SELECT 1 FROM user_number_access una
          WHERE una.number_id = bn.id
          AND una.user_id = (select auth.uid())
        ) OR
        is_super_admin()
      )
    )
  );

-- User Number Access Policies
DROP POLICY IF EXISTS "Users can view own access" ON user_number_access;
DROP POLICY IF EXISTS "Super admins can grant access" ON user_number_access;
DROP POLICY IF EXISTS "Super admins can revoke access" ON user_number_access;

CREATE POLICY "Users can view own access"
  ON user_number_access FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    is_super_admin()
  );

CREATE POLICY "Super admins can grant access"
  ON user_number_access FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can revoke access"
  ON user_number_access FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- =====================================================
-- STEP 5: Update Existing Users with app_metadata
-- =====================================================

-- Update all existing users to have role in app_metadata
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT up.id, up.role 
    FROM user_profiles up
  LOOP
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
        jsonb_build_object('role', user_record.role)
    WHERE id = user_record.id;
  END LOOP;
END $$;
