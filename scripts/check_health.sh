#!/bin/bash
# Check Database Health and Permissions
# Usage: ./scripts/check_health.sh

echo "🏥 Checking Database Health..."

echo "1. Checking supabase_auth_admin permissions..."
docker compose exec -T db psql -U postgres -c "
SELECT rolname, rolsuper, rolbypassrls 
FROM pg_roles 
WHERE rolname = 'supabase_auth_admin';"

echo "2. Checking installed extensions..."
docker compose exec -T db psql -U postgres -c "
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';"

echo "3. Checking User Profiles trigger..."
docker compose exec -T db psql -U postgres -c "
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';"

echo "4. Checking handle_new_user function..."
docker compose exec -T db psql -U postgres -c "
\df public.handle_new_user"

echo "✅ Health check complete."
