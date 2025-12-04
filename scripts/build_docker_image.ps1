
# Build script for Whatsappy Cloud Docker Image

$ErrorActionPreference = "Stop"

# Check for .env file
$EnvPath = "$PSScriptRoot/../.env"
$EnvProdPath = "$PSScriptRoot/../.env.prod.example"

$SupabaseUrl = $null
$SupabaseAnonKey = $null

if (Test-Path $EnvPath) {
    Write-Host "Loading configuration from .env..." -ForegroundColor Cyan
    # Simple .env parser
    $EnvContent = Get-Content $EnvPath
    foreach ($line in $EnvContent) {
        if ($line -match "^\s*DOMAIN=(.*)") {
            $Domain = $matches[1].Trim()
            $SupabaseUrl = "https://$Domain/api"
        }
        if ($line -match "^\s*ANON_KEY=(.*)") {
            $SupabaseAnonKey = $matches[1].Trim()
        }
    }
}

# Fallback/Prompt if keys are missing
if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
    Write-Host "DOMAIN or VITE_SUPABASE_URL not found in .env" -ForegroundColor Yellow
    $Domain = Read-Host "Enter your domain (e.g. chat.example.com)"
    if ([string]::IsNullOrWhiteSpace($Domain)) {
        Write-Host "Using default: localhost"
        $Domain = "localhost"
    }
    $SupabaseUrl = "https://$Domain/api"
}

if ([string]::IsNullOrWhiteSpace($SupabaseAnonKey)) {
    Write-Host "ANON_KEY not found in .env" -ForegroundColor Yellow
    $SupabaseAnonKey = Read-Host "Enter your Supabase Anon Key"
    if ([string]::IsNullOrWhiteSpace($SupabaseAnonKey)) {
        Write-Host "Using dummy key for build (App will not connect to Supabase)" -ForegroundColor Red
        $SupabaseAnonKey = "dummy_key"
    }
}

Write-Host "Building Docker Image..." -ForegroundColor Cyan
Write-Host "URL: $SupabaseUrl"
Write-Host "Key: $SupabaseAnonKey (hidden)"

docker build -t whatsappy-cloud:latest `
    --build-arg VITE_SUPABASE_URL=$SupabaseUrl `
    --build-arg VITE_SUPABASE_ANON_KEY=$SupabaseAnonKey `
    "$PSScriptRoot/.."

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build Successful! Image: whatsappy-cloud:latest" -ForegroundColor Green
} else {
    Write-Host "Build Failed!" -ForegroundColor Red
}
