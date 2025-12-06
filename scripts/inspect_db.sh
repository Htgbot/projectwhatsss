#!/bin/bash

# Inspect DB Script
# Usage: ./scripts/inspect_db.sh

echo "🔍 Inspecting Database Structure..."

echo "--- 1. Public Schema Tables ---"
docker compose exec -T db psql -U postgres -d postgres -c "\dt public.*"

echo "--- 2. User Profiles Definition ---"
docker compose exec -T db psql -U postgres -d postgres -c "\d public.user_profiles"

echo "--- 3. Auth Users Definition ---"
docker compose exec -T db psql -U postgres -d postgres -c "\d auth.users"

echo "--- 4. Triggers on auth.users ---"
docker compose exec -T db psql -U postgres -d postgres -c "SELECT tgname, tgenabled, tgrelid::regclass FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass;"

echo "--- 5. Definition of handle_new_user ---"
docker compose exec -T db psql -U postgres -d postgres -c "\sf public.handle_new_user"

echo "--- 6. Supabase Auth Admin Permissions ---"
docker compose exec -T db psql -U postgres -d postgres -c "SELECT * FROM pg_roles WHERE rolname = 'supabase_auth_admin';"

echo "✅ Inspection Complete."
