$deploy = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$repo = Split-Path -Parent $deploy

if (-not (Get-Command mongosh -ErrorAction SilentlyContinue)) {
  Write-Host "mongosh was not found. Install the MongoDB Shell (mongosh) and run this again." -ForegroundColor Red
  exit 1
}
if (-not (Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue)) {
  Write-Host "MongoDB is not running on port 27017. Start the MongoDB service first (services.msc, MongoDB Server)." -ForegroundColor Red
  exit 1
}

Write-Host "Importing the demo database. Run this BEFORE starting the DMS or the examination service." -ForegroundColor Cyan
Set-Location "$repo\examination-service"
mongosh --quiet --file demo-data\import-db.js
Write-Host ""
Write-Host "Done. Collections that already had rows were left untouched." -ForegroundColor Green
