#!/bin/bash

# Sync Passwords Script
# This script forcefully updates the database user passwords to match the .env file
# Useful after restoring a backup where passwords might have reverted.

echo "🔐 Syncing database passwords with .env configuration..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    exit 1
fi

# Load .env variables
export $(grep -v '^#' .env | xargs)

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ Error: POSTGRES_PASSWORD is not set in .env"
    exit 1
fi

echo "   Target Password: (hidden)"

# Wait for DB to be ready
echo "⏳ Waiting for database to be ready..."
until docker compose exec -T db pg_isready -U postgres; do
    echo "   DB not ready yet..."
    sleep 2
done

echo "🔄 Updating passwords for critical roles..."

docker compose exec -T db psql -U postgres -d postgres -c "
-- Update critical roles to match the environment variable
ALTER ROLE postgres WITH PASSWORD '$POSTGRES_PASSWORD';
ALTER ROLE supabase_auth_admin WITH PASSWORD '$POSTGRES_PASSWORD';
ALTER ROLE authenticator WITH PASSWORD '$POSTGRES_PASSWORD';
ALTER ROLE service_role WITH PASSWORD '$POSTGRES_PASSWORD';
ALTER ROLE supabase_storage_admin WITH PASSWORD '$POSTGRES_PASSWORD';
ALTER ROLE supabase_admin WITH PASSWORD '$POSTGRES_PASSWORD';
ALTER ROLE dashboard_user WITH PASSWORD '$POSTGRES_PASSWORD';

-- Ensure permissions are correct (re-run of fix_auth_permissions logic)
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO supabase_auth_admin;
ALTER ROLE supabase_auth_admin SET search_path = 'auth', 'public';
"

echo "✅ Passwords updated successfully!"
echo "🔄 Restarting affected services..."
docker compose restart auth rest storage

echo "🎉 Done! Services should now be healthy."
