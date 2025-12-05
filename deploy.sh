#!/bin/bash

# Deploy Script for Ubuntu VPS
# Usage: ./deploy.sh

echo "🚀 Starting Deployment..."

# 1. Pull the latest changes from Git
echo "📥 Pulling latest changes from Git..."
git pull origin master

# 1.5 Check and Generate .env if missing
if [ ! -f ".env" ]; then
    echo "⚠️ .env file not found. Generating one with secure keys..."
    if [ -f "./scripts/generate_env_standalone.cjs" ]; then
        # Use a temporary Node container to run the generation script
        # This avoids needing Node installed on the host
        docker run --rm -v "$(pwd):/app" -w /app node:20-alpine node scripts/generate_env_standalone.cjs
        echo "✅ .env generated successfully."
    else
        echo "❌ Error: scripts/generate_env_standalone.cjs not found!"
        exit 1
    fi
fi

# 2. Pre-fix: Ensure DB is ready and fix potentially missing types
echo "🔧 Preparing database..."
docker compose up -d db
# Wait for DB to be ready (simple sleep or healthcheck loop)
echo "⏳ Waiting for database to be ready..."
sleep 10

# Fix missing auth.factor_type if needed (prevents supabase-auth crash)
echo "🛠️ Ensuring auth.factor_type exists and has correct owner..."
docker compose exec -T db psql -U postgres -d postgres -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factor_type') THEN CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone'); END IF; END \$\$; ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;" || echo "⚠️ Warning: Could not create/fix factor_type"

# 3. Rebuild and restart containers
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

# 5. Run Diagnostics
if [ -f "./check_vps.sh" ]; then
    echo "🔍 Running post-deployment diagnostics..."
    chmod +x ./check_vps.sh
    ./check_vps.sh
fi

echo "✅ Deployment Complete! Your changes are now live."
