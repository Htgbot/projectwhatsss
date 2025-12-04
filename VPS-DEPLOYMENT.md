
# VPS Deployment Guide (Docker)

This guide explains how to host the WhatsAppy Cloud project on a VPS using Docker.

## Quick Start (Script)

We have provided a helper script to automate the setup.

1.  **Upload** your project to the VPS.
2.  **Run the deployment script**:
    ```bash
    chmod +x scripts/deploy_vps.sh
    ./scripts/deploy_vps.sh
    ```
3.  **Follow the prompts** to set your domain and keys.

---

## Manual Deployment Steps

### 1. Prerequisites

-   **VPS**: Ubuntu 20.04+ with 4GB+ RAM.
-   **Docker**: Installed (`curl -fsSL https://get.docker.com | sh`).
-   **Ports**: Open ports 80 and 443 in your firewall.

### 2. Configuration

1.  Create `.env` file:
    ```bash
    cp .env.prod.example .env
    nano .env
    ```
2.  **CRITICAL**:
    -   Set `DOMAIN` to your actual domain (e.g., `chat.example.com`) or IP address.
    -   Generate `JWT_SECRET` and Supabase keys (`ANON_KEY`, `SERVICE_ROLE_KEY`) using a JWT tool.
    -   Ensure keys match the `JWT_SECRET`.

### 3. Start Services

Run the production compose file. We use `--build` to ensure the frontend uses the correct keys.

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Verify Deployment

1.  **Check Containers**:
    ```bash
    docker compose -f docker-compose.prod.yml ps
    ```
    All services should be `healthy`.

2.  **Access App**:
    -   Open your browser to `http://YOUR_DOMAIN` (or `https://`).
    -   **Do NOT use port 8080**. The app is served via Caddy on port 80/443.

### 5. Troubleshooting

-   **"Connection Refused"**: Check if Caddy is running (`docker logs project-caddy-1`).
-   **"Supabase Connection Error"**:
    -   Check Browser Console (F12).
    -   Ensure `VITE_SUPABASE_ANON_KEY` in `.env` is correct.
    -   Ensure `kong` service is healthy.
-   **Database Issues**:
    -   If tables are missing, you need to run migrations or import a dump (see `Step 4: Database Setup` below).

## Database Setup (Important)

Your production database starts empty. You must import your schema.

1.  **Dump local schema**:
    ```bash
    # On your local machine
    npx supabase db dump --data-only > data.sql
    ```
2.  **Import to VPS**:
    ```bash
    # On VPS
    cat data.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U postgres
    ```
