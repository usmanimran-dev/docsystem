# The front end is its own repository (github.com/usmanimran-dev/docfinder)
# and is NOT inside this folder. By default it is expected beside it:
#
#   Downloads\docfinder\           <- front end
#   Downloads\docfinder-backend\   <- this folder
#
# Set DOCFINDER_FRONTEND to point somewhere else.

$deploy = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backendRoot = Split-Path -Parent $deploy

if ($env:DOCFINDER_FRONTEND) {
  $frontend = $env:DOCFINDER_FRONTEND
} else {
  $frontend = Join-Path (Split-Path -Parent $backendRoot) 'docfinder'
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js was not found. Install Node 20 or later and run this again." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path (Join-Path $frontend 'package.json'))) {
  Write-Host "The front end was not found at:" -ForegroundColor Red
  Write-Host "  $frontend"
  Write-Host ""
  Write-Host "Clone it beside this folder:" -ForegroundColor Yellow
  Write-Host "  git clone https://github.com/usmanimran-dev/docfinder.git"
  Write-Host ""
  Write-Host "or set DOCFINDER_FRONTEND to wherever you keep it."
  exit 1
}

Set-Location $frontend
if (-not (Test-Path 'node_modules')) {
  Write-Host "node_modules is missing, running npm install (needs internet, takes a few minutes)..." -ForegroundColor Yellow
  npm install
}

Write-Host "Starting the app from $frontend" -ForegroundColor Cyan
Write-Host "The first start takes about a minute. Then open http://localhost:4200" -ForegroundColor Cyan
npm start
