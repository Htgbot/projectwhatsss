#!/bin/bash

echo "🔍 Starting VPS Diagnostics..."

# 1. Check if Docker containers are running
echo "----------------------------------------"
echo "🐳 Checking Docker Containers..."
docker compose ps -a

# 2. Check Caddy Logs for Errors
echo "----------------------------------------"
echo "📜 Checking Caddy Logs (Last 50 lines)..."
docker compose logs --tail=50 caddy

# 2b. Check Auth and Storage Logs (Crucial for Login/Files)
echo "----------------------------------------"
echo "📜 Checking Supabase Auth Logs..."
docker compose logs --tail=20 auth
echo "📜 Checking Supabase Storage Logs..."
docker compose logs --tail=20 storage

# 2c. Check REST and Realtime Logs (WebSocket and PostgREST)
echo "----------------------------------------"
echo "📜 Checking PostgREST Logs..."
docker compose logs --tail=30 rest
echo "📜 Checking Realtime Logs..."
docker compose logs --tail=30 realtime

# 3. Check if Ports 80 and 443 are open on the OS
echo "----------------------------------------"
echo "🔌 Checking Open Ports (OS Level)..."
netstat -tulpn | grep -E ':(80|443)'

# 4. Check UFW Status
echo "----------------------------------------"
echo "防火墙 Checking UFW Status..."
if command -v ufw > /dev/null; then
    ufw status verbose
else
    echo "UFW not installed."
fi

# 5. Check Internal Connectivity (Bypassing External Firewall)
echo "----------------------------------------"
echo "🔗 Testing Internal Connectivity...";
echo "Trying to connect to https://whtshtg.lkdevs.com (resolving to 127.0.0.1)...";
# Use a known health endpoint (Auth) via Kong/Caddy
curl -v -k --resolve whtshtg.lkdevs.com:443:127.0.0.1 https://whtshtg.lkdevs.com/api/auth/v1/health > /dev/null 2>curl_output.txt
if [ $? -eq 0 ]; then
    echo "✅ Internal connection successful! Caddy is working.";
    echo "👉 If you cannot access the site from your browser, the issue is your VPS PROVIDER'S FIREWALL (AWS Security Group, etc.).";
else
    echo "❌ Internal connection failed. Caddy is likely not running correctly or SSL handshake failed.";
    echo "Debug output:";
    cat curl_output.txt | grep -i "ssl\|error\|warn\|fail";
fi
rm curl_output.txt

# 6. Check Database Tables
echo "----------------------------------------"
echo "🗄️ Checking Database Tables..."
echo "Listing all tables in public schema:"
docker compose exec -T db psql -U postgres -d postgres -c "\dt public.*"

echo "----------------------------------------"
echo "✅ Diagnostics Complete."
