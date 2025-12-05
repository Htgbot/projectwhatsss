-- Verify pgcrypto
DO $$
BEGIN
  PERFORM gen_salt('bf');
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'pgcrypto functions not found, attempting to create extension...';
  CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
END $$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_managed_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_managed_user TO service_role;

-- Verify company_id columns exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_numbers' AND column_name = 'company_id') THEN
    RAISE EXCEPTION 'Missing company_id in business_numbers';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quick_replies' AND column_name = 'company_id') THEN
    RAISE EXCEPTION 'Missing company_id in quick_replies';
  END IF;
END $$;
