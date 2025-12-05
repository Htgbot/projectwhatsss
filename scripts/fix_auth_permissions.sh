#!/bin/bash

# Fix Supabase Auth Permissions Script
# Usage: ./scripts/fix_auth_permissions.sh

echo "🔧 Fixing Supabase Auth permissions to resolve 'Database error querying schema'..."

# 1. Ensure factor_type exists (Critical for newer GoTrue versions)
echo "   - Checking auth.factor_type..."
docker compose exec -T db psql -U postgres -d postgres -c "
DO \$\$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factor_type') THEN 
        CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone'); 
    END IF; 
END \$\$;
ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;
"

# 2. Grant Full Permissions to supabase_auth_admin
echo "   - Granting schema permissions..."
docker compose exec -T db psql -U postgres -d postgres -c "
-- Grant usage on schema
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;

-- Grant all privileges on all tables, sequences, and routines in auth schema
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO supabase_auth_admin;

-- Ensure the owner of the schema is correct
ALTER SCHEMA auth OWNER TO supabase_auth_admin;

-- Fix search path
ALTER ROLE supabase_auth_admin SET search_path = 'auth', 'public';
"

# 3. Restart Auth Service
echo "🔄 Restarting supabase-auth service..."
docker compose restart auth

echo "✅ Permissions fixed! Try logging in again."
