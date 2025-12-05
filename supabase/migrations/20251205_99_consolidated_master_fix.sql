-- Master Migration Fix (Consolidated)
-- This file ensures the database is in the correct state for the latest deployment.
-- It is idempotent and can be run multiple times.

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 2. Core Tables (Companies, User Profiles, API Settings)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subscription_status TEXT CHECK (subscription_status IN ('active', 'locked', 'past_due')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    role TEXT CHECK (role IN ('superadmin', 'admin', 'worker')) DEFAULT 'admin',
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add company_id to user_profiles if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'company_id') THEN
        ALTER TABLE public.user_profiles ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.api_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    ycloud_api_key TEXT,
    webhook_secret TEXT,
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id),
    UNIQUE(company_id)
);

-- 3. Chat Tables (Conversations, Messages, Business Numbers, Quick Replies)
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  contact_name text NOT NULL,
  last_message text DEFAULT '',
  last_message_time timestamptz DEFAULT now(),
  unread_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(phone_number, company_id)
);

-- Add company_id to conversations if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'company_id') THEN
        ALTER TABLE public.conversations ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  message_id text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  status text DEFAULT 'sent',
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add company_id to messages if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'company_id') THEN
        ALTER TABLE public.messages ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.business_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    display_name TEXT,
    status TEXT DEFAULT 'active', 
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns to business_numbers (status, user_id, company_id)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_numbers' AND column_name = 'company_id') THEN
        ALTER TABLE public.business_numbers ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_numbers' AND column_name = 'status') THEN
        ALTER TABLE public.business_numbers ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
        ALTER TABLE public.business_numbers ADD CONSTRAINT business_numbers_status_check CHECK (status IN ('pending', 'active', 'rejected'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_numbers' AND column_name = 'user_id') THEN
        ALTER TABLE public.business_numbers ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    shortcut TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add company_id to quick_replies if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quick_replies' AND column_name = 'company_id') THEN
        ALTER TABLE public.quick_replies ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

-- 5. Functions
-- Helper function to get current user's company_id
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

-- 6. Policies (Clean Slate Approach - Drop all relevant policies first)
DO $$
BEGIN
    -- Drop existing policies to ensure we apply the correct ones
    DROP POLICY IF EXISTS "Superadmin all companies" ON public.companies;
    DROP POLICY IF EXISTS "Admin view own company" ON public.companies;
    DROP POLICY IF EXISTS "Superadmin all profiles" ON public.user_profiles;
    DROP POLICY IF EXISTS "Admin view company profiles" ON public.user_profiles;
    DROP POLICY IF EXISTS "Self view profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Self update profile" ON public.user_profiles;
    
    -- Conversation Policies
    DROP POLICY IF EXISTS "Users can view company conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Users can update company conversations" ON public.conversations;
    
    -- Message Policies
    DROP POLICY IF EXISTS "Users can view company messages" ON public.messages;
    
    -- Business Number Policies
    DROP POLICY IF EXISTS "Users can view company numbers" ON public.business_numbers;
    
    -- Quick Reply Policies
    DROP POLICY IF EXISTS "Users can view company quick replies" ON public.quick_replies;
    DROP POLICY IF EXISTS "Users can manage company quick replies" ON public.quick_replies;
END $$;

-- Create Policies

-- Companies
CREATE POLICY "Superadmin all companies" ON public.companies
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

CREATE POLICY "Admin view own company" ON public.companies
    FOR SELECT USING (
        id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

-- User Profiles
CREATE POLICY "Superadmin all profiles" ON public.user_profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

CREATE POLICY "Admin view company profiles" ON public.user_profiles
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Self view profile" ON public.user_profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Self update profile" ON public.user_profiles
    FOR UPDATE USING (id = auth.uid());

-- Conversations (Isolated by Company)
CREATE POLICY "Users can view company conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (
  (company_id = get_my_company_id()) OR
  (get_my_role() = 'superadmin')
);

CREATE POLICY "Users can update company conversations"
ON public.conversations FOR UPDATE
TO authenticated
USING (
  (company_id = get_my_company_id()) OR
  (get_my_role() = 'superadmin')
);

-- Messages (Isolated by Company via Conversation)
CREATE POLICY "Users can view company messages"
ON public.messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND (
      c.company_id = get_my_company_id() OR
      get_my_role() = 'superadmin'
    )
  )
);

-- Business Numbers (Isolated by Company)
CREATE POLICY "Users can view company numbers"
ON public.business_numbers FOR SELECT
TO authenticated
USING (
  (company_id = get_my_company_id()) OR
  (get_my_role() = 'superadmin')
);

-- Quick Replies (Isolated by Company)
CREATE POLICY "Users can view company quick replies"
ON public.quick_replies FOR SELECT
TO authenticated
USING (
  (company_id = get_my_company_id()) OR
  (get_my_role() = 'superadmin')
);

CREATE POLICY "Users can manage company quick replies"
ON public.quick_replies FOR ALL
TO authenticated
USING (
  (company_id = get_my_company_id()) OR
  (get_my_role() = 'superadmin')
);

-- 7. Auth Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, status)
  VALUES (new.id, new.email, 'admin', 'active')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 8. Grant Permissions
GRANT ALL ON public.business_numbers TO postgres;
GRANT ALL ON public.business_numbers TO service_role;
GRANT ALL ON public.business_numbers TO authenticated;
GRANT ALL ON public.business_numbers TO anon;

-- 9. Force Cache Reload
NOTIFY pgrst, 'reload schema';
