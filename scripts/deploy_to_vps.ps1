<#
.SYNOPSIS
    Deploys the project to a VPS via SSH.
.DESCRIPTION
    1. Packages the project into a tarball (excluding node_modules, etc.).
    2. Uploads the tarball to the VPS.
    3. Extracts it to a folder.
#>

$ErrorActionPreference = "Stop"

# --- Configuration ---
$DeployDir = "/opt/whatsappy"
$TarName = "release.tar.gz"

# --- User Input ---
Write-Host "=== WhatsAppy Cloud VPS Deployer ===" -ForegroundColor Cyan
$VpsUser = Read-Host "Enter VPS Username (e.g., root)"
$VpsIp = Read-Host "Enter VPS IP Address"
$KeyPath = Read-Host "Enter path to Private Key (optional, press Enter to skip)"

if ([string]::IsNullOrWhiteSpace($VpsUser) -or [string]::IsNullOrWhiteSpace($VpsIp)) {
    Write-Error "Username and IP are required."
}

$Target = "$VpsUser@$VpsIp"
$SshArgs = @()
if (-not [string]::IsNullOrWhiteSpace($KeyPath)) {
    $SshArgs += "-i"
    $SshArgs += $KeyPath
}

# --- Step 1: Package ---
Write-Host "`n[1/4] Packaging project..." -ForegroundColor Yellow

# Ensure we are in the project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

# Remove old tar if exists
if (Test-Path $TarName) { Remove-Item $TarName }

# Create tarball
# Excluding node_modules, .git, dist, and local env files
tar -czf $TarName `
    --exclude node_modules `
    --exclude .git `
    --exclude .env `
    --exclude .env.local `
    --exclude dist `
    --exclude .DS_Store `
    --exclude supabase/.branches `
    --exclude supabase/.temp `
    .

if (-not (Test-Path $TarName)) {
    Write-Error "Failed to create $TarName"
}
Write-Host "Package created: $TarName" -ForegroundColor Green

# --- Step 2: Prepare Remote ---
Write-Host "`n[2/4] Preparing remote server..." -ForegroundColor Yellow
try {
    # Create directory on remote
    ssh @SshArgs $Target "mkdir -p $DeployDir"
}
catch {
    Write-Error "Failed to connect to $Target. Please check your SSH connection/keys."
}

# --- Step 3: Upload ---
Write-Host "`n[3/4] Uploading to $Target..." -ForegroundColor Yellow
scp @SshArgs $TarName "$Target`:$DeployDir/$TarName"
if ($LASTEXITCODE -ne 0) { Write-Error "Upload failed." }
Write-Host "Upload complete." -ForegroundColor Green

# --- Step 4: Extract ---
Write-Host "`n[4/4] Extracting on remote..." -ForegroundColor Yellow
ssh @SshArgs $Target "cd $DeployDir && tar -xzf $TarName && rm $TarName"
if ($LASTEXITCODE -ne 0) { Write-Error "Extraction failed." }
Write-Host "Extraction complete." -ForegroundColor Green

# --- Cleanup Local ---
Remove-Item $TarName

Write-Host "`n=== Deployment Successful! ===" -ForegroundColor Cyan
Write-Host "Next Steps:"
Write-Host "1. SSH into your server: ssh @SshArgs $Target"
Write-Host "2. Go to directory:    cd $DeployDir"
Write-Host "3. Create .env file:   cp .env.prod.example .env"
Write-Host "4. Edit secrets:       nano .env"
Write-Host "5. Start Docker:       docker compose -f docker-compose.prod.yml up -d"
Write-Host "--------------------------------"
