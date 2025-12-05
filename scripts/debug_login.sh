#!/bin/bash

# Debug Login Script
# Usage: ./scripts/debug_login.sh <email>

EMAIL=$1

if [ -z "$EMAIL" ]; then
  echo "❌ Usage: ./scripts/debug_login.sh <email>"
  exit 1
fi

echo "🔍 Debugging user '$EMAIL'..."

# 1. Check user record in auth.users
echo "📊 Checking auth.users record..."
docker compose exec -T db psql -U postgres -d postgres -c "
SELECT 
    id, 
    email, 
    left(encrypted_password, 10) as pw_hash_prefix, 
    email_confirmed_at, 
    last_sign_in_at,
    raw_app_meta_data,
    aud,
    role
FROM auth.users 
WHERE email = '$EMAIL';
"

# 2. Check identity record
echo "🆔 Checking auth.identities record..."
docker compose exec -T db psql -U postgres -d postgres -c "
SELECT 
    id, 
    provider, 
    provider_id, 
    created_at 
FROM auth.identities 
WHERE user_id = (SELECT id FROM auth.users WHERE email = '$EMAIL');
"

# 3. Check logs
echo "📜 Fetching last 20 auth logs..."
docker compose logs --tail=20 auth

echo "✅ Debug info complete."
