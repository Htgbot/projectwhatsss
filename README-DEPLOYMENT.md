# Deployment and Local Setup Guide

## 1. Local Development with Supabase

To set up your local development environment and clone data from your live Supabase project:

1.  **Prerequisites**:
    *   Install **Docker Desktop** and ensure it is running.
    *   Install **Node.js** (LTS version).

2.  **Run the Setup Script**:
    Open PowerShell as Administrator (or just a regular terminal) and run:
    ```powershell
    ./scripts/setup_local_db.ps1
    ```
    *   This script will start the local Supabase instance.
    *   It will ask for your **Supabase Project Reference ID** and **Database Password**.
    *   It will link your project and clone the data from the remote database to your local instance.

3.  **Start the App**:
    ```bash
    npm run dev
    ```

## 2. Deploying to VPS with Docker

To host your application on a VPS with Docker enabled:

### Option A: Using Docker Compose (Recommended)

1.  **Upload Files**: Copy the entire project (or just `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `package.json`, `package-lock.json`, and `src/`, `public/`) to your VPS.

2.  **Create .env File**: Create a `.env` file in the project root on the VPS with your production keys:
    ```env
    VITE_SUPABASE_URL=your_project_url
    VITE_SUPABASE_ANON_KEY=your_anon_key
    ```

3.  **Build and Run**:
    ```bash
    docker-compose up -d --build
    ```
    The app will be available at `http://your-vps-ip:8080`.

### Option B: Manual Docker Build

1.  **Build the Image**:
    ```bash
    docker build \
      --build-arg VITE_SUPABASE_URL=your_url \
      --build-arg VITE_SUPABASE_ANON_KEY=your_key \
      -t whatsapp-clone .
    ```

2.  **Run the Container**:
    ```bash
    docker run -d -p 80:8080 whatsapp-clone
    ```
    The app will be available on port 80.

## Troubleshooting

*   **Supabase Login**: If the script asks you to log in, run `npx supabase login` and follow the browser instructions.
*   **Docker Errors**: Ensure Docker is running (`docker ps`).
*   **Database Conflicts**: If you want to reset the local database completely, run `npx supabase db reset`.
