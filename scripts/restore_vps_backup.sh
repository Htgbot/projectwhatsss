#!/bin/bash

# restore_vps_backup.sh
# Usage: ./restore_vps_backup.sh
# Make sure vps_backup.sql is in the same directory

BACKUP_FILE="vps_backup.sql"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: $BACKUP_FILE not found!"
    echo "Please upload the backup file first."
    exit 1
fi

echo "========================================="
echo "Restoring database from $BACKUP_FILE..."
echo "========================================="

# Stop services that might lock the DB (optional but safer)
# echo "Stopping services..."
# docker compose stop auth rest realtime

# Restore
# We pipe the file content into the psql command inside the container
cat "$BACKUP_FILE" | docker compose exec -T db psql -U postgres -d postgres

if [ $? -eq 0 ]; then
    echo "========================================="
    echo "Restore completed successfully."
    echo "========================================="
    
    echo "Restarting Auth service..."
    docker compose restart auth
    
    echo "Done! You can now login with the same credentials as your local machine."
else
    echo "========================================="
    echo "Restore FAILED."
    echo "========================================="
    exit 1
fi
