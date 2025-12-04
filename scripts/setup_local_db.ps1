# Check for Docker
$dockerStatus = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "Installing dependencies..."
npm install

# Initialize Supabase if config missing
if (-not (Test-Path "supabase/config.toml")) {
    Write-Host "Initializing Supabase..."
    npx -y supabase init
}

# Start Supabase
Write-Host "Starting local Supabase..."
npx -y supabase start

# Prompt for details
$projectRef = Read-Host "Enter your Live Supabase Project Reference ID"
if (-not $projectRef) {
    Write-Host "Project Reference ID is required." -ForegroundColor Red
    exit 1
}

$dbPassword = Read-Host "Enter your Supabase Database Password" -AsSecureString
$pass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))
$env:SUPABASE_DB_PASSWORD = $pass

# Link Project
Write-Host "Linking project..."
npx -y supabase link --project-ref $projectRef

# Pull Schema
Write-Host "Pulling schema..."
npx -y supabase db pull

# Clone Data
Write-Host "Dumping data from remote..."
npx -y supabase db dump --data-only --linked > data_dump.sql

if (Test-Path "data_dump.sql") {
    Write-Host "Importing data to local database..."
    
    # Find the database container (usually project-name_db_...)
    # We can just use the connection string. Supabase local db is at localhost:54322
    # user: postgres, password: postgres (default for local dev)
    
    # We'll use docker exec to avoid needing psql on host
    # Get container id for the postgres container
    $container = docker ps --format "{{.ID}} {{.Image}}" | Select-String "supabase/postgres" | Select-Object -First 1
    if ($container) {
        $containerId = $container.ToString().Split(" ")[0]
        # Use cmd /c type to pipe in windows powerhsell to docker exec?
        # PowerShell piping:
        Get-Content data_dump.sql | docker exec -i $containerId psql -U postgres -d postgres
        
        Write-Host "Data cloned successfully!" -ForegroundColor Green
    } else {
        Write-Host "Could not find Supabase DB container. Please check if 'supabase start' finished successfully." -ForegroundColor Red
    }
    
    Remove-Item data_dump.sql
} else {
    Write-Host "Failed to download data." -ForegroundColor Red
}

Write-Host "Setup complete! You can now run 'npm run dev' to start the app."
