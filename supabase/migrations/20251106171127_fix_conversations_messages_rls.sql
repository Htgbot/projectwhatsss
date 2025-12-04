/*
  # Fix RLS Policies for Conversations and Messages

  1. Changes
    - Drop existing restrictive policies that require authentication
    - Add new policies that allow all operations for all users (including anonymous)
    - This allows the app to work without authentication
*/

-- Drop existing policies for conversations
DROP POLICY IF EXISTS "Allow all operations on conversations for authenticated users" ON conversations;

-- Create new policy that allows all operations for all users
CREATE POLICY "Allow all operations on conversations"
  ON conversations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Drop existing policies for messages
DROP POLICY IF EXISTS "Allow all operations on messages for authenticated users" ON messages;

-- Create new policy that allows all operations for all users
CREATE POLICY "Allow all operations on messages"
  ON messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Drop existing policies for templates
DROP POLICY IF EXISTS "Allow all operations on templates for authenticated users" ON templates;

-- Create new policy that allows all operations for all users
CREATE POLICY "Allow all operations on templates"
  ON templates
  FOR ALL
  USING (true)
  WITH CHECK (true);