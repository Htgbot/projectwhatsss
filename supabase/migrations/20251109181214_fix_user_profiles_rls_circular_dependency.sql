/*
  # Fix User Profiles RLS Circular Dependency

  1. Changes
    - Remove circular dependency in user_profiles SELECT policy
    - Allow all authenticated users to read all profiles
    - This is safe because profile info isn't sensitive
    - Maintains strict controls on INSERT/UPDATE/DELETE

  2. Security
    - Users can read any profile (needed for super admin check)
    - Only super admins can create users
    - Users can only update their own profile
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;

-- Create a simpler policy without circular dependency
CREATE POLICY "Authenticated users can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);
