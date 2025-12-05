#!/bin/bash

# Deploy Script for Ubuntu VPS
# Usage: ./deploy.sh

echo "🚀 Starting Deployment..."

# 1. Pull the latest changes from Git
echo "📥 Pulling latest changes from Git..."
git pull origin master

# 2. Rebuild and restart containers
echo "🔄 Rebuilding and restarting Docker containers..."
# We use --build to ensure the 'app' container gets the latest code
# --wait ensures services are healthy before proceeding
docker compose up -d --build --wait

# 3. Apply Database Updates and Migrations
if [ -f "./scripts/apply_20251205_updates.sh" ]; then
    echo "🛠️ Applying database updates..."
    chmod +x ./scripts/apply_20251205_updates.sh
    ./scripts/apply_20251205_updates.sh
fi

# 4. Clean up unused images to save space
echo "🧹 Cleaning up unused Docker images..."
docker image prune -f

echo "✅ Deployment Complete! Your changes are now live."
