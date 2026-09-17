# scripts/setup-other-computer.ps1
# DGMC Hospital Dietary Management System - Machine Setup & Startup Script

param(
    [switch]$SkipBuild,
    [switch]$Help
)

if ($Help) {
    Write-Host "DGMC Setup Script" -ForegroundColor Cyan
    Write-Host "Usage: .\setup-other-computer.ps1 [-SkipBuild]" -ForegroundColor Yellow
    exit 0
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  DGMC Dietary Management System - Node & Docker Setup   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

function Invoke-CommandWithFeedback {
    param(
        [string]$CommandText,
        [string]$StepTitle
    )
    Write-Host ""
    Write-Host "[STEP] $StepTitle..." -ForegroundColor Yellow
    Write-Host "Executing: $CommandText" -ForegroundColor DarkGray
    Invoke-Expression -Command $CommandText
    if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
        Write-Warning "Command exited with status code: $LASTEXITCODE"
    }
}

function Test-CommandAvailable {
    param(
        [string]$CommandName
    )
    $cmd = Get-Command -Name $CommandName -ErrorAction SilentlyContinue
    return ($null -ne $cmd)
}

# 1. Verify Prerequisites
Write-Host ""
Write-Host "[1/4] Checking Prerequisites..." -ForegroundColor Green

if (Test-CommandAvailable -CommandName "node") {
    $nodeVer = node --version
    Write-Host "  [OK] Node.js is installed ($nodeVer)" -ForegroundColor Green
} else {
    Write-Error "  [MISSING] Node.js is not found. Please install Node.js (v20+ or v22+)."
}

if (Test-CommandAvailable -CommandName "npm") {
    $npmVer = npm --version
    Write-Host "  [OK] npm is installed ($npmVer)" -ForegroundColor Green
} else {
    Write-Error "  [MISSING] npm is not found."
}

if (Test-CommandAvailable -CommandName "docker") {
    $dockerVer = docker --version
    Write-Host "  [OK] Docker is installed ($dockerVer)" -ForegroundColor Green
} else {
    Write-Warning "  [INFO] Docker is not installed or not in PATH (Local mode can still run)."
}

# 2. Install dependencies
if (-not $SkipBuild) {
    Invoke-CommandWithFeedback -CommandText "npm install" -StepTitle "Installing npm dependencies"
    Invoke-CommandWithFeedback -CommandText "npm run build" -StepTitle "Building production assets"
}

# 3. Environment file check
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Host ""
        Write-Host "[3/4] Creating .env from .env.example..." -ForegroundColor Yellow
        Copy-Item ".env.example" ".env"
        Write-Host "  [OK] .env file created." -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "[3/4] .env already exists." -ForegroundColor Green
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Setup completed! You can run the application with:     " -ForegroundColor Cyan
Write-Host "    - Option 1 (Docker): docker compose up -d             " -ForegroundColor White
Write-Host "    - Option 2 (Local):  npm run start                    " -ForegroundColor White
Write-Host "    - Option 3 (Dev):    npm run dev                      " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
