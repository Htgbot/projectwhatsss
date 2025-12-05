#!/bin/bash

# Fix "Database error finding user" Script
# Usage: ./scripts/fix_db_error.sh

echo "🔧 Diagnosing and fixing 'Database error finding user'..."

# 1. Fix Search Path and Extensions
echo "   - Configuring search_path and extensions..."
docker compose exec -T db psql -U postgres -d postgres -c "
-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Ensure pgcrypto exists in extensions schema
CREATE EXTENSION IF NOT EXISTS \"pgcrypto\" SCHEMA extensions;

-- Grant usage on extensions to supabase_auth_admin and postgres
GRANT USAGE ON SCHEMA extensions TO supabase_auth_admin;
GRANT USAGE ON SCHEMA extensions TO postgres;

-- Grant execute on functions in extensions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO supabase_auth_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO postgres;

-- Update search_path for supabase_auth_admin to include extensions
ALTER ROLE supabase_auth_admin SET search_path = 'auth', 'public', 'extensions';

-- Update search_path for postgres user as well just in case
ALTER ROLE postgres SET search_path = 'public', 'extensions', 'auth';

-- Ensure auth.users owner is correct
ALTER TABLE auth.users OWNER TO supabase_auth_admin;
"

# 2. Check and Fix Triggers
echo "   - Checking for broken triggers..."
docker compose exec -T db psql -U postgres -d postgres -c "
DO \$\$
DECLARE
    t record;
BEGIN
    -- Just a simple check, we can't easily validate PL/pgSQL body here without running it
    -- But we can ensure the trigger functions exist
    FOR t IN 
        SELECT tgname, proname 
        FROM pg_trigger 
        JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid 
        WHERE tgrelid = 'auth.users'::regclass
    LOOP
        RAISE NOTICE 'Found trigger: % calling %', t.tgname, t.proname;
    END LOOP;
END \$\$;
"

# 3. Verify auth.users sequence (if any)
# Sometimes sequence gets out of sync if manual inserts happened, but auth.users uses UUID so it's fine.

echo "🔄 Restarting supabase-auth service to pick up changes..."
docker compose restart auth

echo "✅ Database fixes applied. Please try creating the user again at /tempsuper"
