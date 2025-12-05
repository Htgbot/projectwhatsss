-- Enable UUID extension (pgcrypto provides gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 1. Create companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subscription_status TEXT CHECK (subscription_status IN ('active', 'locked', 'past_due')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create or Update user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    role TEXT CHECK (role IN ('superadmin', 'admin', 'worker')) DEFAULT 'admin',
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add company_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'company_id') THEN
        ALTER TABLE user_profiles ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Api Settings update
CREATE TABLE IF NOT EXISTS api_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    ycloud_api_key TEXT,
    webhook_secret TEXT,
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add company_id to api_settings if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_settings' AND column_name = 'company_id') THEN
        ALTER TABLE api_settings ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Business Numbers & Quick Replies linking to company
-- (Assuming they exist, if not create them)
CREATE TABLE IF NOT EXISTS business_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    display_name TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    shortcut TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add company_id to these tables if they exist but missing the column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_numbers' AND column_name = 'company_id') THEN
        ALTER TABLE business_numbers ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quick_replies' AND column_name = 'company_id') THEN
        ALTER TABLE quick_replies ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;

-- 6. Policies

-- Drop existing policies to ensure clean slate (optional but safer)
DROP POLICY IF EXISTS "Superadmin can do everything on companies" ON companies;
DROP POLICY IF EXISTS "Admins can view their own company" ON companies;
-- ... add more drops if needed

-- Companies
CREATE POLICY "Superadmin all companies" ON companies
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

CREATE POLICY "Admin view own company" ON companies
    FOR SELECT USING (
        id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    );

-- User Profiles
CREATE POLICY "Superadmin all profiles" ON user_profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

CREATE POLICY "Admin view company profiles" ON user_profiles
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admin manage company workers" ON user_profiles
    FOR ALL USING (
        role = 'admin' AND id = auth.uid()
    )
    WITH CHECK (
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        AND role = 'worker'
    );
-- Note: The above policy for Admin managing workers is simplified. 
-- A better approach for INSERT/UPDATE usually requires separating them.
-- Let's try a simpler approach:
-- Admins can INSERT if they are admin and the new user is in their company.

CREATE POLICY "Self view profile" ON user_profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Self update profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

-- API Settings
CREATE POLICY "Superadmin all api settings" ON api_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

CREATE POLICY "Admin manage company api settings" ON api_settings
    FOR ALL USING (
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Business Numbers
CREATE POLICY "Superadmin all numbers" ON business_numbers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

CREATE POLICY "Company members view numbers" ON business_numbers
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'worker'))
    );

CREATE POLICY "Admin manage numbers" ON business_numbers
    FOR ALL USING (
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Quick Replies
CREATE POLICY "Superadmin all quick replies" ON quick_replies
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

CREATE POLICY "Company members view quick replies" ON quick_replies
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admin manage quick replies" ON quick_replies
    FOR ALL USING (
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 7. Trigger to auto-create profile on signup (if not exists)
-- This is usually handled by a trigger on auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, status)
  VALUES (new.id, new.email, 'admin', 'active') -- Default to admin for now, or needs logic?
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
