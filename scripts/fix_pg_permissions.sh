#!/bin/bash
# Fix Postgres Extension Permissions
# Usage: ./scripts/fix_pg_permissions.sh

echo "🔧 Fixing Postgres Extension Permissions..."

# 1. Create the directory and file that pg_read_file is trying to access
# This prevents the "permission denied" error during extension creation
echo "   - Creating extension-custom-scripts directory..."
docker compose exec -T db bash -c "mkdir -p /etc/postgresql-custom/extension-custom-scripts"
docker compose exec -T db bash -c "touch /etc/postgresql-custom/extension-custom-scripts/before-create.sql"
docker compose exec -T db bash -c "chown -R postgres:postgres /etc/postgresql-custom"

# 2. Grant pg_read_server_files to postgres user (if possible)
echo "   - Granting file read permissions..."
docker compose exec -T db psql -U postgres -c "ALTER ROLE postgres WITH SUPERUSER;"
docker compose exec -T db psql -U postgres -c "GRANT pg_read_server_files TO postgres;"

# 3. Force install pgcrypto as postgres
echo "   - Installing pgcrypto..."
docker compose exec -T db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions CASCADE;"

echo "✅ Permissions fixed. You can now run manual_insert_user.sh"
