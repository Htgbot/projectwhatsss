/*
  # Fix Security and Performance Issues

  1. Performance Improvements
    - Add missing indexes on foreign keys for optimal query performance
    - Optimize RLS policies to use (select auth.uid()) pattern
    - Remove unused indexes

  2. Security Improvements
    - Remove duplicate permissive policies
    - Fix function search paths to be immutable
    - Consolidate RLS policies for better security

  3. Changes Made
    - Add indexes: business_numbers(user_id), conversations(business_number_id), 
      user_number_access(granted_by), user_number_access(number_id)
    - Drop unused indexes: idx_conversations_from_number, idx_messages_from_number
    - Drop duplicate "Allow all operations" policies
    - Recreate all RLS policies with (select auth.uid()) pattern
    - Fix function search paths for handle_new_user and create_super_admin_user

  Note: Password leak protection must be enabled manually in Supabase Dashboard > Authentication > Settings
*/

-- =====================================================
-- STEP 1: Add Missing Indexes on Foreign Keys
-- =====================================================

-- Index for business_numbers.user_id
CREATE INDEX IF NOT EXISTS idx_business_numbers_user_id 
  ON business_numbers(user_id);

-- Index for conversations.business_number_id
CREATE INDEX IF NOT EXISTS idx_conversations_business_number_id 
  ON conversations(business_number_id);

-- Index for user_number_access.granted_by
CREATE INDEX IF NOT EXISTS idx_user_number_access_granted_by 
  ON user_number_access(granted_by);

-- Index for user_number_access.number_id
CREATE INDEX IF NOT EXISTS idx_user_number_access_number_id 
  ON user_number_access(number_id);

-- Index for user_number_access.user_id (for faster lookups)
CREATE INDEX IF NOT EXISTS idx_user_number_access_user_id 
  ON user_number_access(user_id);

-- =====================================================
-- STEP 2: Remove Unused Indexes
-- =====================================================

DROP INDEX IF EXISTS idx_conversations_from_number;
DROP INDEX IF EXISTS idx_messages_from_number;

-- =====================================================
-- STEP 3: Remove Duplicate Permissive Policies
-- =====================================================

-- Drop the overly permissive "Allow all operations" policies
DROP POLICY IF EXISTS "Allow all operations on business_numbers" ON business_numbers;
DROP POLICY IF EXISTS "Allow all operations on conversations" ON conversations;
DROP POLICY IF EXISTS "Allow all operations on messages" ON messages;

-- =====================================================
-- STEP 4: Recreate RLS Policies with Optimized Pattern
-- =====================================================

-- Drop existing policies to recreate with optimized pattern
DROP POLICY IF EXISTS "Users can view accessible numbers" ON business_numbers;
DROP POLICY IF EXISTS "Users can insert own numbers" ON business_numbers;
DROP POLICY IF EXISTS "Users can update own numbers" ON business_numbers;
DROP POLICY IF EXISTS "Users can delete own numbers" ON business_numbers;

DROP POLICY IF EXISTS "Users can view accessible conversations" ON conversations;
DROP POLICY IF EXISTS "System can insert conversations" ON conversations;
DROP POLICY IF EXISTS "System can update conversations" ON conversations;

DROP POLICY IF EXISTS "Users can view accessible messages" ON messages;
DROP POLICY IF EXISTS "System can insert messages" ON messages;
DROP POLICY IF EXISTS "System can update messages" ON messages;

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Super admins can create users" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

DROP POLICY IF EXISTS "Users can view own API settings" ON api_settings;
DROP POLICY IF EXISTS "Users can insert own API settings" ON api_settings;
DROP POLICY IF EXISTS "Users can update own API settings" ON api_settings;
DROP POLICY IF EXISTS "Users can delete own API settings" ON api_settings;

DROP POLICY IF EXISTS "Users can view own access" ON user_number_access;
DROP POLICY IF EXISTS "Super admins can grant access" ON user_number_access;
DROP POLICY IF EXISTS "Super admins can revoke access" ON user_number_access;

-- =====================================================
-- Recreate Business Numbers Policies (Optimized)
-- =====================================================

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
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (select auth.uid()) AND up.role = 'super_admin'
    )
  );

CREATE POLICY "Users can insert own numbers"
  ON business_numbers FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own numbers"
  ON business_numbers FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (select auth.uid()) AND up.role = 'super_admin'
    )
  );

CREATE POLICY "Users can delete own numbers"
  ON business_numbers FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (select auth.uid()) AND up.role = 'super_admin'
    )
  );

-- =====================================================
-- Recreate Conversations Policies (Optimized)
-- =====================================================

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
        EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = (select auth.uid()) AND up.role = 'super_admin'
        )
      )
    )
  );

CREATE POLICY "System can insert conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (true);

-- =====================================================
-- Recreate Messages Policies (Optimized)
-- =====================================================

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
        EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = (select auth.uid()) AND up.role = 'super_admin'
        )
      )
    )
  );

CREATE POLICY "System can insert messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (true);

-- =====================================================
-- Recreate User Profiles Policies (Optimized)
-- =====================================================

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = id OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (select auth.uid()) AND up.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can create users"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (select auth.uid()) AND up.role = 'super_admin'
    )
  );

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = id OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (select auth.uid()) AND up.role = 'super_admin'
    )
  );

-- =====================================================
-- Recreate API Settings Policies (Optimized)
-- =====================================================

CREATE POLICY "Users can view own API settings"
  ON api_settings FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own API settings"
  ON api_settings FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own API settings"
  ON api_settings FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own API settings"
  ON api_settings FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- =====================================================
-- Recreate User Number Access Policies (Optimized)
-- =====================================================

CREATE POLICY "Users can view own access"
  ON user_number_access FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (select auth.uid()) AND up.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can grant access"
  ON user_number_access FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (select auth.uid()) AND up.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can revoke access"
  ON user_number_access FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (select auth.uid()) AND up.role = 'super_admin'
    )
  );

-- =====================================================
-- STEP 5: Fix Function Search Paths
-- =====================================================

-- Recreate handle_new_user with proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$;

-- Recreate create_super_admin_user with proper search_path if it exists
DROP FUNCTION IF EXISTS public.create_super_admin_user(text, text, text);
CREATE OR REPLACE FUNCTION public.create_super_admin_user(
  p_email text,
  p_password text,
  p_display_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    json_build_object('display_name', p_display_name, 'role', 'super_admin'),
    now(),
    now(),
    '',
    ''
  ) RETURNING id INTO v_user_id;

  -- Create user profile (trigger should handle this, but we'll ensure it)
  INSERT INTO public.user_profiles (id, email, display_name, role)
  VALUES (v_user_id, p_email, p_display_name, 'super_admin')
  ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

  v_result := json_build_object(
    'success', true,
    'message', 'Super admin created successfully',
    'user_id', v_user_id
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'message', SQLERRM
  );
END;
$$;

-- =====================================================
-- STEP 6: Add Comments for Documentation
-- =====================================================

COMMENT ON INDEX idx_business_numbers_user_id IS 'Optimizes queries filtering business numbers by user';
COMMENT ON INDEX idx_conversations_business_number_id IS 'Optimizes queries joining conversations with business numbers';
COMMENT ON INDEX idx_user_number_access_granted_by IS 'Optimizes queries tracking who granted access';
COMMENT ON INDEX idx_user_number_access_number_id IS 'Optimizes queries finding users with access to a number';
COMMENT ON INDEX idx_user_number_access_user_id IS 'Optimizes queries finding numbers accessible to a user';
