/*
  # Update API Settings for YCloud Integration

  1. Changes
    - Create `api_settings` table if it doesn't exist
    - Add `ycloud_api_key` column if it doesn't exist
    - Add `company_id` column if it doesn't exist
    - Make `webhook_secret` nullable if it exists (legacy)
    - Add RLS policies for company-level access
*/

-- Create api_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.api_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    company_id uuid REFERENCES public.companies(id),
    ycloud_api_key text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(company_id)
);

-- Add ycloud_api_key column if it doesn't exist (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_settings' AND column_name = 'ycloud_api_key'
  ) THEN
    ALTER TABLE public.api_settings ADD COLUMN ycloud_api_key text;
  END IF;
END $$;

-- Add company_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_settings' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.api_settings ADD COLUMN company_id uuid REFERENCES public.companies(id);
    -- Add unique constraint for company_id
    ALTER TABLE public.api_settings ADD CONSTRAINT api_settings_company_id_key UNIQUE (company_id);
  END IF;
END $$;

-- Make webhook_secret nullable if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_settings' AND column_name = 'webhook_secret'
  ) THEN
    ALTER TABLE public.api_settings ALTER COLUMN webhook_secret DROP NOT NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.api_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Users can view company api settings" ON public.api_settings;
DROP POLICY IF EXISTS "Users can manage company api settings" ON public.api_settings;
DROP POLICY IF EXISTS "Users can insert own API settings" ON public.api_settings;
DROP POLICY IF EXISTS "Users can update own API settings" ON public.api_settings;
DROP POLICY IF EXISTS "Users can delete own API settings" ON public.api_settings;
DROP POLICY IF EXISTS "Users can view own API settings" ON public.api_settings;

-- Create new policies based on company_id

CREATE POLICY "Users can view company api settings"
ON public.api_settings FOR SELECT
TO authenticated
USING (
  (company_id = get_my_company_id()) OR
  (get_my_role() = 'superadmin')
);

CREATE POLICY "Users can manage company api settings"
ON public.api_settings FOR ALL
TO authenticated
USING (
  (company_id = get_my_company_id()) OR
  (get_my_role() = 'superadmin')
);
