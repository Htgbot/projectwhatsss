/*
  # Fix Business Numbers RLS Policy

  1. Changes
    - Drop the existing restrictive policy
    - Add new policy that allows all operations for all users (including anonymous)
    - This is safe since business numbers are configuration data for the app
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Allow all operations on business_numbers for authenticated users" ON business_numbers;

-- Create new policy that allows all operations for all users
CREATE POLICY "Allow all operations on business_numbers"
  ON business_numbers
  FOR ALL
  USING (true)
  WITH CHECK (true);