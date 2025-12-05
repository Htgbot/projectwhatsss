#!/bin/bash
set -e

echo "🚀 Applying 2025-12-05 Database Updates..."

# Check if docker compose is running
if ! docker compose ps | grep -q "Up"; then
    echo "❌ Error: Docker containers are not running."
    exit 1
fi

# Function to apply a migration file
apply_migration() {
    local file=$1
    if [ -f "$file" ]; then
        echo "Applying $file..."
        cat "$file" | docker compose exec -T db psql -U postgres -d postgres
    else
        echo "⚠️ Warning: File $file not found!"
    fi
}

# Apply migrations in order
apply_migration "supabase/migrations/20251205_00_ensure_core_tables.sql"
apply_migration "supabase/migrations/20251205_add_business_number_status.sql"
apply_migration "supabase/migrations/20251205_add_unique_constraint_api_settings.sql"
apply_migration "supabase/migrations/20251205_enforce_company_isolation.sql"
apply_migration "supabase/migrations/20251205_fix_create_managed_user.sql"
apply_migration "supabase/migrations/20251205_update_api_settings_for_ycloud.sql"

# Force schema cache reload
echo "🔄 Reloading PostgREST schema cache..."
apply_migration "supabase/migrations/20251205_reload_schema_cache.sql"

echo "✅ All updates applied successfully!"
