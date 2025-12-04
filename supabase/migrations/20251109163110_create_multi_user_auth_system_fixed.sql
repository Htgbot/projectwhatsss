/*
  # Multi-User Authentication System with Role-Based Access

  1. New Tables
    - `user_profiles` - User roles and info
    - `api_settings` - API keys per user
    - `user_number_access` - Number access control
  
  2. Security
    - RLS policies for role-based access
    - Super admin full control
    - Users see only assigned resources
*/

-- Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'user')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can create users"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'super_admin'
    )
  );

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'super_admin'
    )
  );

-- Create API settings table
CREATE TABLE IF NOT EXISTS api_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  ycloud_api_key text NOT NULL,
  webhook_secret text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE api_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API settings"
  ON api_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API settings"
  ON api_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API settings"
  ON api_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API settings"
  ON api_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add user_id to business_numbers if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_numbers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE business_numbers ADD COLUMN user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create user-number access mapping table
CREATE TABLE IF NOT EXISTS user_number_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  number_id uuid NOT NULL REFERENCES business_numbers(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES user_profiles(id),
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, number_id)
);

ALTER TABLE user_number_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own access"
  ON user_number_access FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can grant access"
  ON user_number_access FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can revoke access"
  ON user_number_access FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'super_admin'
    )
  );

-- Update business_numbers RLS policies
DROP POLICY IF EXISTS "Users can view business numbers" ON business_numbers;
DROP POLICY IF EXISTS "Users can insert business numbers" ON business_numbers;
DROP POLICY IF EXISTS "Users can update business numbers" ON business_numbers;
DROP POLICY IF EXISTS "Users can delete business numbers" ON business_numbers;

CREATE POLICY "Users can view accessible numbers"
  ON business_numbers FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_number_access una
      WHERE una.number_id = business_numbers.id
      AND una.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'super_admin'
    )
  );

CREATE POLICY "Users can insert own numbers"
  ON business_numbers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own numbers"
  ON business_numbers FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'super_admin'
    )
  );

CREATE POLICY "Users can delete own numbers"
  ON business_numbers FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'super_admin'
    )
  );

-- Add business_number_id to conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'business_number_id'
  ) THEN
    ALTER TABLE conversations ADD COLUMN business_number_id uuid REFERENCES business_numbers(id);
  END IF;
END $$;

-- Update conversations RLS
DROP POLICY IF EXISTS "Users can view conversations" ON conversations;
DROP POLICY IF EXISTS "Users can insert conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update conversations" ON conversations;

CREATE POLICY "Users can view accessible conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_numbers bn
      WHERE bn.phone_number = conversations.from_number
      AND (
        bn.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_number_access una
          WHERE una.number_id = bn.id
          AND una.user_id = auth.uid()
        ) OR
        EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid() AND up.role = 'super_admin'
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

-- Update messages RLS
DROP POLICY IF EXISTS "Users can view messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;
DROP POLICY IF EXISTS "Users can update messages" ON messages;

CREATE POLICY "Users can view accessible messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN business_numbers bn ON bn.phone_number = c.from_number
      WHERE c.id = messages.conversation_id
      AND (
        bn.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_number_access una
          WHERE una.number_id = bn.id
          AND una.user_id = auth.uid()
        ) OR
        EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid() AND up.role = 'super_admin'
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

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();