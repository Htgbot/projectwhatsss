#!/bin/bash

# Fix Database Errors Script
# Usage: ./scripts/fix_db_error.sh

echo "🔧 Diagnosing and fixing database issues..."

# 1. Apply the fix_auth_trigger migration directly
echo "   - Applying auth trigger fixes..."
docker compose exec -T db psql -U postgres -d postgres -c "
-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Ensure pgcrypto exists
CREATE EXTENSION IF NOT EXISTS \"pgcrypto\" SCHEMA extensions;

-- Grant usage on extensions
GRANT USAGE ON SCHEMA extensions TO supabase_auth_admin, postgres, authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO supabase_auth_admin, postgres, authenticated, anon, service_role;

-- Fix search path for supabase_auth_admin
ALTER ROLE supabase_auth_admin SET search_path = 'auth', 'public', 'extensions';
ALTER ROLE postgres SET search_path = 'public', 'extensions', 'auth';

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

echo "✅ Database fixes applied. Please try creating the user again at /tempsuper"
