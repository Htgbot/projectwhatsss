#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo ">>> Error: No domain provided."
    echo "Usage: ./scripts/setup_domain.sh <your-domain>"
    echo "Example: ./scripts/setup_domain.sh whtshtg.lkdevs.com"
    exit 1
fi

NEW_DOMAIN=$1

echo ">>> Configuring server for domain: $NEW_DOMAIN"

# Ensure .env exists
if [ ! -f .env ]; then
    echo ">>> .env not found. Copying from example..."
    cp .env.prod.example .env
fi

# Update DOMAIN in .env
# Use a temporary file to ensure atomic write and handle different line endings if needed
if grep -q "^DOMAIN=" .env; then
    sed -i "s|^DOMAIN=.*|DOMAIN=$NEW_DOMAIN|" .env
else
    echo "DOMAIN=$NEW_DOMAIN" >> .env
fi

echo ">>> Updated .env with DOMAIN=$NEW_DOMAIN"

# Stop Caddy to force a cert refresh on restart
echo ">>> Restarting Caddy to provision SSL certificates..."
docker compose stop caddy
docker compose rm -f caddy
docker compose up -d caddy

echo ">>> Done!"
echo ">>> Caddy is now obtaining an SSL certificate for $NEW_DOMAIN from Let's Encrypt."
echo ">>> This may take a minute. You can check logs with: docker logs -f projectwhatsss-caddy-1"
