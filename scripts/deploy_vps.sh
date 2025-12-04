#!/bin/bash

# VPS Deployment Helper Script

# Stop on error
set -e

echo ">>> Starting VPS Deployment Setup..."

# 0. Check execution directory
if [ ! -f "docker-compose.yml" ]; then
    echo ">>> Error: docker-compose.yml not found!"
    echo ">>> Please run this script from the project root directory."
    echo ">>> Example: ./scripts/deploy_vps.sh"
    exit 1
fi

# 1. Check for .env file
if [ ! -f .env ]; then
    echo ">>> .env file not found. Creating from .env.prod.example..."
    cp .env.prod.example .env
    
    echo ">>> Please enter your DOMAIN (e.g. chat.mydomain.com) or IP:"
    read DOMAIN_INPUT
    
    if [ -z "$DOMAIN_INPUT" ]; then
        echo ">>> No domain provided. Defaulting to localhost."
        DOMAIN_INPUT="localhost"
    fi
    
    # Update DOMAIN in .env
    sed -i "s/DOMAIN=your-domain.com/DOMAIN=$DOMAIN_INPUT/g" .env
    
    echo ">>> IMPORTANT: You must edit .env to set secure passwords and keys!"
    echo ">>> Press Enter to continue after you have edited .env (or Ctrl+C to stop and edit manually)..."
    read
fi

# 2. Pull latest changes (if using git)
# git pull origin main

# 3. Prune old images to save space
echo ">>> Cleaning up old Docker images and containers..."
# Explicitly stop and remove the old 'web' service if it exists
docker stop web-1 2>/dev/null || true
docker rm web-1 2>/dev/null || true
docker compose down --remove-orphans
docker system prune -f

# 4. Build and Start Services
echo ">>> Building and Starting Services..."
# We use --build to ensure the frontend picks up the latest env vars (ANON_KEY)
docker compose up -d --build

# 5. Wait for Healthchecks
echo ">>> Waiting for services to be healthy..."
sleep 10
docker compose ps

echo ">>> Deployment Complete!"
echo ">>> Access your app at: http://$(grep DOMAIN .env | cut -d '=' -f2)"
echo ">>> (Note: HTTPS will be auto-provisioned by Caddy if you used a valid domain)"
