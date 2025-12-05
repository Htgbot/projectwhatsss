#!/bin/bash

# Restore Database from Backup Script
# Usage: ./scripts/restore_db.sh <backup_file.sql>

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Usage: ./scripts/restore_db.sh <path_to_backup.sql>"
  echo "   Example: ./scripts/restore_db.sh backup.sql"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: File '$BACKUP_FILE' not found."
  exit 1
fi

echo "⚠️  WARNING: This will OVERWRITE the current database with data from '$BACKUP_FILE'."
echo "   The 'auth' and 'public' schemas will be modified."
echo "   Press Ctrl+C to cancel, or wait 5 seconds to proceed..."
sleep 5

echo "📥 Restoring database from $BACKUP_FILE..."
# We use -v ON_ERROR_STOP=1 to stop if there are major errors, 
# but sometimes backups have minor errors we want to ignore. 
# For now, we pipe directly.
cat "$BACKUP_FILE" | docker compose exec -T db psql -U postgres -d postgres

echo "✅ Restore completed."

# After restore, permissions might be messed up because the backup might not include role grants
# or might have different owners.
echo "🔧 Re-applying critical permissions..."

if [ -f "./scripts/fix_auth_permissions.sh" ]; then
    chmod +x ./scripts/fix_auth_permissions.sh
    ./scripts/fix_auth_permissions.sh
else
    echo "⚠️  Warning: scripts/fix_auth_permissions.sh not found. Please run it manually if login fails."
fi

echo "🎉 Database restore and permission fix complete!"
