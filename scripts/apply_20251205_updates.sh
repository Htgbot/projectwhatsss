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
# This master fix file consolidates previous fixes into one idempotent script
apply_migration "supabase/migrations/20251205_99_consolidated_master_fix.sql"

# Apply other specific fixes if needed (idempotent)
apply_migration "supabase/migrations/20251205_fix_create_managed_user.sql"
apply_migration "supabase/migrations/20251205_update_api_settings_for_ycloud.sql"

# Force schema cache reload
echo "🔄 Reloading PostgREST schema cache..."
apply_migration "supabase/migrations/20251205_reload_schema_cache.sql"

echo "✅ All updates applied successfully!"
