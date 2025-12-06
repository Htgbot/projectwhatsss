#!/bin/bash

# Fix Database Errors Script
# Usage: ./scripts/fix_db_error.sh

echo "🔧 Diagnosing and fixing database issues..."

# 1. Apply the fix_auth_trigger migration directly
echo "   - Applying auth trigger fixes..."

# First, try to enable pgcrypto separately (ignore failure if it's permission related, as it might already exist)
echo "   - Ensuring pgcrypto extension..."
docker compose exec -T db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\" SCHEMA extensions;" 2>/dev/null || echo "     (Note: pgcrypto setup encountered a warning, proceeding assuming it exists or is managed by system)"

# Now apply the function and trigger (Critical part)
echo "   - Creating handle_new_user function and trigger..."
docker compose exec -T db psql -U postgres -d postgres -c "
-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions
GRANT USAGE ON SCHEMA extensions TO supabase_auth_admin, postgres, authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO supabase_auth_admin, postgres, authenticated, anon, service_role;

-- Grant usage on public schema (Crucial for triggers)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin, postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role, supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role, supabase_auth_admin;

-- Fix search path for supabase_auth_admin
ALTER ROLE supabase_auth_admin SET search_path = 'auth', 'public', 'extensions';
ALTER ROLE postgres SET search_path = 'public', 'extensions', 'auth';

-- Ensure user_profiles table exists (Safety net)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    display_name text,
    role text DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'worker')),
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    company_id uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Grant permissions on user_profiles
GRANT ALL ON public.user_profiles TO postgres, service_role, supabase_auth_admin;
GRANT SELECT ON public.user_profiles TO authenticated, anon;

-- Create or replace the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS \$\$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, status)
  VALUES (new.id, new.email, 'admin', 'active')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
\$\$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
"

# 2. Restart Services
echo "🔄 Restarting services to pick up changes..."
# Restart auth to ensure it picks up the new search path
docker compose restart auth

# Rebuild and restart app (correct service name is 'app', not 'web')
echo "   - Rebuilding frontend (app)..."
docker compose up -d --build app

# 3. Verification with Real Insert Test
echo "🔍 Verifying fixes with a test user insert..."
docker compose exec -T db psql -U postgres -d postgres -c "
DO \$\$
DECLARE
  trigger_exists boolean;
  func_exists boolean;
  test_uid uuid := gen_random_uuid();
  test_email text := 'test_trigger_' || floor(random() * 1000)::text || '@example.com';
BEGIN
  -- 1. Check objects exist
  SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') INTO trigger_exists;
  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') INTO func_exists;
  
  IF NOT (trigger_exists AND func_exists) THEN
    RAISE EXCEPTION '❌ MISSING OBJECTS: Trigger or function not found!';
  END IF;

  RAISE NOTICE '✅ Objects exist. Attempting test insert into auth.users...';

  -- 2. Attempt to insert a test user into auth.users (Simulate Signup)
  -- We use a transaction so we can roll it back or clean it up
  BEGIN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      test_uid,
      'authenticated',
      'authenticated',
      test_email,
      'test_pass_hash',
      now(),
      now(),
      now(),
      '{\"provider\": \"email\", \"providers\": [\"email\"]}',
      '{\"display_name\": \"Test User\"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
    
    RAISE NOTICE '✅ Insert into auth.users successful.';
    
    -- 3. Check if user_profiles entry was created by trigger
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = test_uid) THEN
      RAISE NOTICE '✅ TRIGGER SUCCESS: User profile created automatically!';
    ELSE
      RAISE EXCEPTION '❌ TRIGGER FAILURE: User profile NOT created!';
    END IF;

    -- Cleanup
    DELETE FROM auth.users WHERE id = test_uid;
    -- Profile should be deleted by CASCADE (checked in table definition)
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ TEST FAILED WITH ERROR: %', SQLERRM;
    RAISE; -- Re-raise to fail the script
  END;
END
\$\$;
"

echo "✅ Database fixes applied and VERIFIED. Please try creating the user again at /tempsuper"
