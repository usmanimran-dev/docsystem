# Imad's DMS jar lives in its own folder, not in here. By default it is
# expected beside this one:
#
#   Downloads\docfinder-backend\   this folder
#   Downloads\edms-dms\            the jar and its config
#
# Set EDMS_DMS to point somewhere else.

$deploy = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backendRoot = Split-Path -Parent $deploy

if ($env:EDMS_DMS) {
  $dmsFolder = $env:EDMS_DMS
} else {
  $dmsFolder = Join-Path (Split-Path -Parent $backendRoot) 'edms-dms'
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  Write-Host "Java was not found. Install Java 17 and run this again." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path (Join-Path $dmsFolder 'edms\properties\dmsclientext-0.0.1.jar'))) {
  Write-Host "The DMS jar was not found at:" -ForegroundColor Red
  Write-Host "  $dmsFolder\edms\properties\dmsclientext-0.0.1.jar"
  Write-Host ""
  Write-Host "Put the edms-dms folder beside this one, or set EDMS_DMS to its path." -ForegroundColor Yellow
  exit 1
}

# The jar reads its config from a fixed path, d:/edms/properties, and cannot be
# pointed anywhere else. On a laptop with no D: drive, map one to the DMS folder.
$jar = "D:\edms\properties\dmsclientext-0.0.1.jar"
if (-not (Test-Path $jar)) {
  if (-not (Test-Path "D:\")) {
    subst D: $dmsFolder
    Write-Host "This laptop has no D: drive, so D: was mapped to $dmsFolder." -ForegroundColor Yellow
    Write-Host "A subst drive is lost on reboot - run this script again after a restart." -ForegroundColor Yellow
  } else {
    Write-Host "A D: drive exists but the DMS files are not in D:\edms\properties." -ForegroundColor Red
    Write-Host "Copy '$dmsFolder\edms' to D:\ (so you get D:\edms\properties) and run this again."
    exit 1
  }
}

if (-not (Test-Path $jar)) {
  Write-Host "Cannot find $jar" -ForegroundColor Red
  exit 1
}

Write-Host "Starting the DMS backend on port 8082. Leave this window open." -ForegroundColor Cyan
Set-Location "D:\edms\properties"
java -jar dmsclientext-0.0.1.jar --spring.config.location=file:./clientapplication.properties
