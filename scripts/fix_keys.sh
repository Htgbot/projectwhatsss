#!/bin/bash
set -e

echo ">>> Checking for weak security keys..."

if [ ! -f .env ]; then
    echo ">>> .env file not found! Please run deploy_vps.sh first to generate it."
    exit 1
fi

# Check if using default/weak keys
if grep -q "your-super-secret-jwt-token" .env || grep -q "your-anon-key" .env; then
    echo ">>> Default placeholder keys detected. Generating secure keys..."
    
    # 1. Generate JWT Secret (32 chars hex = 64 chars string, plenty secure)
    # We use openssl which is standard on Ubuntu
    JWT_SECRET=$(openssl rand -hex 32)
    
    echo ">>> Generating JWT tokens (using Docker node container)..."
    
    # 2. Generate Tokens using Node via Docker
    # This ensures we have a correct environment without installing node on host
    GEN_SCRIPT="
    const crypto = require('crypto');

    function sign(payload, secret) {
      const header = { alg: 'HS256', typ: 'JWT' };
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const signature = crypto.createHmac('sha256', secret)
        .update(encodedHeader + '.' + encodedPayload)
        .digest('base64url');
      return \`\${encodedHeader}.\${encodedPayload}.\${signature}\`;
    }

    const secret = '$JWT_SECRET';
    const anonPayload = { role: 'anon', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 3153600000 }; // ~100 years
    const servicePayload = { role: 'service_role', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 3153600000 };

    console.log('ANON_KEY=' + sign(anonPayload, secret));
    console.log('SERVICE_ROLE_KEY=' + sign(servicePayload, secret));
    "

    # Run node in docker
    KEYS=$(docker run --rm node:20-alpine node -e "$GEN_SCRIPT")
    
    ANON_KEY=$(echo "$KEYS" | grep ANON_KEY | cut -d= -f2)
    SERVICE_ROLE_KEY=$(echo "$KEYS" | grep SERVICE_ROLE_KEY | cut -d= -f2)
    
    if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
        echo ">>> Error generating keys. Please check docker logs."
        exit 1
    fi

    echo ">>> Updating .env file..."
    
    # Backup
    cp .env .env.bak
    
    # Update JWT_SECRET
    # We use | as delimiter to avoid issues with / in paths (though keys are base64url)
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    
    # Update ANON_KEY
    sed -i "s|^ANON_KEY=.*|ANON_KEY=$ANON_KEY|" .env
    
    # Update SERVICE_ROLE_KEY
    sed -i "s|^SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY|" .env
    
    echo ">>> Keys successfully updated!"
    echo ">>> JWT_SECRET and Supabase Keys have been replaced with secure generated values."

else
    echo ">>> Keys appear to be already changed from defaults. Skipping generation."
fi

echo ">>> Done."
