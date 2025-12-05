-- Ensure core tables exist to prevent "Tables Missing" errors
-- This migration combines setup_roles.sql and update_conversations_schema.sql logic
-- It is idempotent (IF NOT EXISTS)

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 1. Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subscription_status TEXT CHECK (subscription_status IN ('active', 'locked', 'past_due')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. User Profiles Table
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

-- 3. API Settings Table
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

-- 4. Conversations Table
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

-- 5. Messages Table
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

-- 6. Business Numbers Table
CREATE TABLE IF NOT EXISTS public.business_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    display_name TEXT,
    status TEXT DEFAULT 'active', 
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add company_id to business_numbers if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_numbers' AND column_name = 'company_id') THEN
        ALTER TABLE public.business_numbers ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 7. Quick Replies Table
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

-- 8. Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

-- 9. Basic Policies for Companies and User Profiles (others handled by enforce_company_isolation.sql)

-- Companies
DROP POLICY IF EXISTS "Superadmin all companies" ON public.companies;
CREATE POLICY "Superadmin all companies" ON public.companies
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

DROP POLICY IF EXISTS "Admin view own company" ON public.companies;
CREATE POLICY "Admin view own company" ON public.companies
    FOR SELECT USING (
        id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

-- User Profiles
DROP POLICY IF EXISTS "Superadmin all profiles" ON public.user_profiles;
CREATE POLICY "Superadmin all profiles" ON public.user_profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

DROP POLICY IF EXISTS "Admin view company profiles" ON public.user_profiles;
CREATE POLICY "Admin view company profiles" ON public.user_profiles
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Self view profile" ON public.user_profiles;
CREATE POLICY "Self view profile" ON public.user_profiles
    FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Self update profile" ON public.user_profiles;
CREATE POLICY "Self update profile" ON public.user_profiles
    FOR UPDATE USING (id = auth.uid());

-- 10. Auth Trigger
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
