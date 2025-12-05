# PowerShell Script to Backup Local Supabase Database
# Usage: .\scripts\backup_local.ps1

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "backup_local_$timestamp.sql"

Write-Host "⏳ Starting backup of local Supabase database to $backupFile..." -ForegroundColor Cyan

# Check if docker is running
$container = docker compose ps -q db
if (-not $container) {
    Write-Host "❌ Error: Docker container 'db' does not seem to be running." -ForegroundColor Red
    Write-Host "   Please start your local Supabase first: docker compose up -d"
    exit 1
}

# Dump the database
# We use pg_dumpall to capture roles and permissions as well
# We use cmd /c to handle redirection properly in PowerShell mixed with Docker
cmd /c "docker compose exec -T db pg_dumpall --clean --if-exists --user postgres > $backupFile"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backup successful: $backupFile" -ForegroundColor Green
    Write-Host "   You can now upload this file to your VPS." -ForegroundColor Cyan
    Write-Host "   Example upload command:" -ForegroundColor Yellow
    Write-Host "   scp $backupFile root@whtshtg.lkdevs.com:~/projectwhatsss/$backupFile"
} else {
    Write-Host "❌ Backup failed." -ForegroundColor Red
}
