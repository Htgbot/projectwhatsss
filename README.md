# Whatsappy Cloud – Deployment, JWT Keys, Webhooks, and Troubleshooting

This guide explains how to configure environment secrets, generate JWT keys, deploy the stack on a VPS, set up YCloud webhooks, and diagnose common issues (especially Realtime WebSocket failures and webhook delivery).

## Overview
- Frontend served by `Caddy` at your `DOMAIN`
- Supabase services behind `Kong` at `/api/*`
- Realtime WebSocket proxied directly to the `realtime` container with a path rewrite
- Edge Functions (Deno) under `/api/functions/v1/*`
- All data isolated per `company_id` with RLS policies; messages only visible for approved business numbers

## Prerequisites
- Ubuntu VPS with Docker and Docker Compose
- A DNS `A` record pointing your `DOMAIN` to the VPS IP
- Open ports `80` and `443` on VPS firewall

## Environment Variables (.env)
Create a `.env` file in the project root with at least:

```
DOMAIN=chat.example.com
POSTGRES_PASSWORD=<strong-db-password>

# Shared HMAC secret used to sign/verify JWTs across services
JWT_SECRET=<long-random-secret>

# JWT tokens signed with JWT_SECRET
ANON_KEY=<jwt-with-role-anon>
SERVICE_ROLE_KEY=<jwt-with-role-service_role>

# Optional: generate if not set
REALTIME_DB_ENC_KEY=<random-32-64-bytes>
```

Notes:
- `ANON_KEY` and `SERVICE_ROLE_KEY` must be valid JWTs signed with the exact `JWT_SECRET`.
- The browser uses `ANON_KEY`. Realtime validates WebSocket handshakes against `JWT_SECRET`.
- Edge functions use `SERVICE_ROLE_KEY` to perform privileged operations.

## Generate Secrets and Keys

### 1) Generate a strong `JWT_SECRET`
```
openssl rand -hex 64
```
Paste the output into `.env` as `JWT_SECRET`.

### 2) Generate `ANON_KEY` and `SERVICE_ROLE_KEY` signed with `JWT_SECRET`
Use a Node one‑liner inside Docker (no local Node required). Replace `<YOUR_SECRET>` first:

```
export JWT_SECRET="<YOUR_SECRET>"

# ANON_KEY
docker run --rm -e JWT_SECRET node:20-alpine node -e "
const c=require('crypto');
const b64u=x=>Buffer.from(x).toString('base64').replace(/=|\+|\//g,m=>({'=':'','+':'-','/':'_'}[m]));
const h=b64u(JSON.stringify({alg:'HS256',typ:'JWT'}));
const p=b64u(JSON.stringify({role:'anon',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+315360000}));
const s=b64u(c.createHmac('sha256',process.env.JWT_SECRET).update(h+'.'+p).digest());
console.log(h+'.'+p+'.'+s)"

# SERVICE_ROLE_KEY
docker run --rm -e JWT_SECRET node:20-alpine node -e "
const c=require('crypto');
const b64u=x=>Buffer.from(x).toString('base64').replace(/=|\+|\//g,m=>({'=':'','+':'-','/':'_'}[m]));
const h=b64u(JSON.stringify({alg:'HS256',typ:'JWT'}));
const p=b64u(JSON.stringify({role:'service_role',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+315360000}));
const s=b64u(c.createHmac('sha256',process.env.JWT_SECRET).update(h+'.'+p).digest());
console.log(h+'.'+p+'.'+s)"
```
Paste outputs into `.env` as `ANON_KEY` and `SERVICE_ROLE_KEY`.

### 3) Generate `REALTIME_DB_ENC_KEY` (recommended)
```
openssl rand -hex 32
```

## Build and Run
From the VPS project directory:

```
git reset --hard HEAD
git pull origin master
chmod +x deploy.sh
./deploy.sh
```

What this does:
- Rebuilds the `app` image so `ANON_KEY` is baked into the frontend
- Starts/updates Caddy, Kong, Supabase services
- Applies idempotent SQL migrations and reloads PostgREST schema
- Runs diagnostics (`check_vps.sh`) to verify ports, logs, and SSL

## Service Endpoints
- Frontend: `https://$DOMAIN/`
- Supabase REST: `https://$DOMAIN/api/rest/v1/*`
- Supabase Auth: `https://$DOMAIN/api/auth/v1/*`
- Edge Functions: `https://$DOMAIN/api/functions/v1/*`
- Realtime WS: `wss://$DOMAIN/api/realtime/v1/websocket?apikey=<ANON_KEY>&vsn=1.0.0`

## Realtime WebSocket Routing
The `Caddyfile` is configured to rewrite Realtime paths:
- Incoming `wss://$DOMAIN/api/realtime/v1/websocket` → rewritten to `/socket/websocket` on `realtime:4000`
- API routes are matched before frontend routes to avoid shadowing

Verify:
- Browser DevTools → Network → the WebSocket should get `101 Switching Protocols`
- If it fails, check `docker compose logs --tail=50 realtime` for `invalid JWT` or `unauthorized`

## Database Migrations and RLS
Migrations ensure all core tables exist and RLS is enforced:
- `companies`, `user_profiles`, `conversations`, `messages`, `business_numbers`, `quick_replies`, `api_settings`
- Policies use secure helper functions:
  - `get_my_company_id()` and `get_my_role()` to avoid recursive RLS checks

If you see NOTICEs like “policy … does not exist, skipping” — that’s expected when clearing old policies before recreating.

## YCloud Webhook Setup
1) In YCloud, set webhook URL to:
```
https://$DOMAIN/api/functions/v1/whatsapp-webhook
```
2) Ensure the company has an `api_settings.ycloud_api_key` saved.
3) Add business numbers in Settings; they must be **approved** (status `active`) by the superadmin. Unapproved numbers are ignored by the webhook.
4) The webhook handler stores inbound messages only for active numbers and attaches them to the correct `company_id`.

## Troubleshooting

### WebSocket fails
- Check keys:
  - `grep -E '^(JWT_SECRET|ANON_KEY|SERVICE_ROLE_KEY)=' .env`
  - `docker compose exec -T realtime env | grep -E 'API_JWT_SECRET|JWT_SECRET'`
  - `docker compose exec -T app env | grep VITE_SUPABASE_ANON_KEY`
- Mismatch between `JWT_SECRET` and token signature → handshake fails
- Check logs:
  - `docker compose logs --tail=50 realtime`
  - `docker compose logs --tail=50 caddy`
  - `docker compose logs --tail=50 rest`

### SSL/TLS errors
- Internal connectivity test (Auth health):
```
./check_vps.sh
```
- If internal succeeds but external fails, review your VPS provider firewall/security groups.

### “Tables missing”
- List tables:
```
docker compose exec -T db psql -U postgres -d postgres -c "\dt public.*"
```
- Re-apply updates:
```
chmod +x scripts/apply_20251205_updates.sh
./scripts/apply_20251205_updates.sh
```

### Webhook not saving messages
- Ensure business number is `active` (approved by superadmin)
- Ensure `api_settings.ycloud_api_key` exists for the company
- Check function logs (Edge Runtime):
```
docker compose logs --tail=100 functions
```

## Useful Commands
- Restart critical services:
```
docker compose restart caddy realtime kong
```
- Tail logs:
```
docker compose logs --tail=50 <service>
# services: caddy, kong, rest, auth, storage, realtime, functions
```
- Prune unused images:
```
docker image prune -f
```

## References (Code)
- Frontend Supabase client: `src/lib/supabase.ts:13`
- Caddy Realtime rewrite: `Caddyfile:23`
- Kong services: `supabase/config/kong.yml:20-34`
- Webhook handler: `supabase/functions/whatsapp-webhook/index.ts`
- Migrations: `supabase/migrations/20251205_99_consolidated_master_fix.sql`

---
Follow this guide carefully to ensure keys and routing are aligned. Once `ANON_KEY` matches `JWT_SECRET`, Realtime connects; with approved business numbers and a configured YCloud API key, webhook messages will flow into the correct company.
