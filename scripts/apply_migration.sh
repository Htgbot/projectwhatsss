#!/bin/bash
set -e

echo ">>> Applying Database Migration for Roles and Companies..."

# Check if docker compose is running
if ! docker compose ps | grep -q "Up"; then
    echo ">>> Error: Docker containers are not running. Please run ./scripts/deploy_vps.sh first."
    exit 1
fi

# Run SQL inside the container
# We use cat to pipe the file content into the docker exec command
echo "Applying base schema (20251106163301_create_whatsapp_schema.sql)..."
cat supabase/migrations/20251106163301_create_whatsapp_schema.sql | docker compose exec -T db psql -U postgres -d postgres

echo "Applying setup_roles.sql..."
cat scripts/setup_roles.sql | docker compose exec -T db psql -U postgres -d postgres

echo "Applying create_managed_user.sql..."
cat scripts/create_managed_user.sql | docker compose exec -T db psql -U postgres -d postgres

echo "Applying create_company_and_admin.sql..."
cat scripts/create_company_and_admin.sql | docker compose exec -T db psql -U postgres -d postgres

echo "Applying update_conversations_schema.sql..."
cat scripts/update_conversations_schema.sql | docker compose exec -T db psql -U postgres -d postgres

echo "Applying fix_schema_and_policies.sql..."
cat scripts/fix_schema_and_policies.sql | docker compose exec -T db psql -U postgres -d postgres

echo ">>> Migration applied successfully!"
