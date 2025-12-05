#!/bin/bash
set -e

echo "Running init script with POSTGRES_PASSWORD..."

# Default to 'postgres' if POSTGRES_USER is not set
DB_USER=${POSTGRES_USER:-postgres}
DB_NAME=${POSTGRES_DB:-postgres}

# Use the POSTGRES_PASSWORD environment variable for the new roles so they match docker-compose
# We escape the password in case it has special characters (basic handling)

psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" <<-EOSQL
  -- Create roles if they don't exist
  DO
  \$do\$
  BEGIN
     IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
     END IF;
     
     IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
     END IF;
     
     IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
     END IF;

     IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD '$POSTGRES_PASSWORD';
     END IF;
     
     IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'dashboard_user') THEN
        CREATE ROLE dashboard_user NOINHERIT LOGIN PASSWORD '$POSTGRES_PASSWORD';
     END IF;
     
     IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin NOINHERIT LOGIN PASSWORD '$POSTGRES_PASSWORD';
     END IF;
     
     IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        CREATE ROLE supabase_storage_admin NOINHERIT LOGIN PASSWORD '$POSTGRES_PASSWORD';
     END IF;
     
     IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin CREATEROLE CREATEDB LOGIN PASSWORD '$POSTGRES_PASSWORD';
     END IF;
  END
  \$do\$;

  -- Grant permissions
  GRANT anon TO authenticator;
  GRANT authenticated TO authenticator;
  GRANT service_role TO authenticator;
  GRANT supabase_admin TO authenticator;

  -- Create schemas
  CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
  CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
  CREATE SCHEMA IF NOT EXISTS _realtime;

  -- Grant usage on schemas
  GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin, dashboard_user;
  GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role, supabase_auth_admin, dashboard_user;
  GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role, supabase_storage_admin, dashboard_user;
  GRANT USAGE ON SCHEMA _realtime TO postgres, anon, authenticated, service_role;

  -- Grant create on public to admins
  GRANT CREATE ON SCHEMA public TO supabase_auth_admin, supabase_storage_admin, supabase_admin;

  -- Default Privileges
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;

  -- Grant all to supabase_auth_admin on auth schema
  GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
  ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO supabase_auth_admin;
  ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON FUNCTIONS TO supabase_auth_admin;
  ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_auth_admin;

  -- Grant usage on extensions schema
   CREATE SCHEMA IF NOT EXISTS extensions;
   GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin, dashboard_user;
   GRANT ALL ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin, dashboard_user;
   
   -- Extensions will be installed manually or by services if needed to avoid init permission issues
EOSQL
