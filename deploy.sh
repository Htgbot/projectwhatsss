#!/bin/bash

# Deploy Script for Ubuntu VPS
# Usage: ./deploy.sh

echo "🚀 Starting Deployment..."

# 1. Pull the latest changes from Git
echo "📥 Pulling latest changes from Git..."
git pull origin main

# 2. Rebuild and restart containers
echo "🔄 Rebuilding and restarting Docker containers..."
# We use --build to ensure the 'app' container gets the latest code
docker compose up -d --build

# 3. Clean up unused images to save space
echo "🧹 Cleaning up unused Docker images..."
docker image prune -f

echo "✅ Deployment Complete! Your changes are now live."
