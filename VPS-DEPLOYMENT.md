# VPS Deployment Guide (Docker)

This guide explains how to host the WhatsAppy Cloud project (Frontend + Supabase + Webhooks) on a single VPS using Docker.

## Prerequisites

1.  **VPS**: A server (Ubuntu 20.04/22.04 recommended) with at least 4GB RAM (Supabase stack is heavy).
2.  **Docker & Docker Compose**: Pre-installed.
    - Verify with `docker -v` and `docker compose version`.
3.  **Domain**: A domain name (e.g., `chat.yourdomain.com`) pointing to your VPS IP address (A Record).

## Step 1: Setup Project on VPS

### Option A: One-Click Deployment Script (Recommended)
If you are on Windows (PowerShell), use our included script to upload everything automatically.

1.  Run the script:
    ```powershell
    ./scripts/deploy_to_vps.ps1
    ```
2.  Enter your VPS Username (e.g., `root`) and IP Address when prompted.
3.  The script will upload the project files to `/opt/whatsappy` on your VPS.

### Option B: Manual Upload
1.  **Copy Files**: Upload your project files to the VPS (e.g., via `git clone` or `scp`).
    ```bash
    # Example using git
    git clone <your-repo-url> /opt/whatsappy
    cd /opt/whatsappy
    ```

2.  **Create Production Configs**:
    We have prepared a production docker-compose file (`docker-compose.prod.yml`) and Caddyfile.

3.  **Configure Environment Variables**:
    Copy the example env file:
    ```bash
    cp .env.prod.example .env
    ```
    
    **CRITICAL**: Edit `.env` and fill in the values.
    ```bash
    nano .env
    ```
    - `DOMAIN`: Your domain (e.g., `chat.example.com`).
    - `POSTGRES_PASSWORD`: Generate a strong password.
    - `JWT_SECRET`: Generate a random 32+ char string.
    - `ANON_KEY` & `SERVICE_ROLE_KEY`:
        - You must generate these JWTs using your `JWT_SECRET`.
        - Use a tool like [jwt.io](https://jwt.io/) or a script.
        - **Anon Key Payload**:
          ```json
          {
            "role": "anon",
            "iss": "supabase",
            "iat": 1717238400,
            "exp": 2032814400
          }
          ```
        - **Service Role Key Payload**:
          ```json
          {
            "role": "service_role",
            "iss": "supabase",
            "iat": 1717238400,
            "exp": 2032814400
          }
          ```
        - *Note: `iat` is current timestamp, `exp` is future timestamp.*

## Step 2: Start the Services

Run the production stack:

```bash
docker compose -f docker-compose.prod.yml up -d
```

This will:
1.  Start the Supabase Database, Auth, Realtime, Storage, etc.
2.  Start the Edge Runtime for Webhooks.
3.  Build and start the Frontend App.
4.  Start Caddy (Reverse Proxy) which will **automatically obtain SSL certificates** for your domain.

## Step 3: Verify Deployment

1.  Visit `https://chat.yourdomain.com`. You should see the login page.
2.  Check logs if something is wrong:
    ```bash
    docker compose -f docker-compose.prod.yml logs -f
    ```

## Step 4: Database Setup

Your production database is empty. You need to apply the schema.

**Option A: SQL Dump (Recommended)**
1.  On your **local** machine (where you have the data), dump the schema and data:
    ```bash
    npx supabase db dump --data-only > data.sql
    # OR for full schema if not synced
    npx supabase db dump > full_backup.sql
    ```
2.  Upload `full_backup.sql` to VPS.
3.  Import into production DB:
    ```bash
    cat full_backup.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U postgres
    ```

## Step 5: Webhook Configuration

Your Webhook URL for YCloud (and others) will be:

```
https://chat.yourdomain.com/api/functions/v1/whatsapp-webhook
```

1.  Go to YCloud Dashboard.
2.  Update the Webhook URL to the one above.
3.  Test by sending a message.

## Notes

- **Mailpit**: We removed Mailpit for production. If you need email (for password resets), configure the SMTP variables in `.env`.
- **Security**: ensure ports 5432 (DB) and 8000 (Kong) are firewall-protected if you don't want them exposed publicly. Caddy handles 80/443.
- **Storage**: Data is persisted in `./supabase/volumes`. Back this directory up regularly.

## Troubleshooting Webhooks

If webhooks fail:
1.  Check Edge Runtime logs:
    ```bash
    docker compose -f docker-compose.prod.yml logs functions
    ```
2.  Ensure your domain resolves correctly.
3.  Ensure the path `/api/functions/v1/...` is correctly routed by trying to `curl` it.

