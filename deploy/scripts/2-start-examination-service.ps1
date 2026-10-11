$deploy = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$repo = Split-Path -Parent $deploy

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  Write-Host "Java was not found. Install Java 17 and run this again." -ForegroundColor Red
  exit 1
}

$jar = "$repo\examination-service\target\examination-service.jar"
if (-not (Test-Path $jar)) {
  Write-Host "The jar is not in git. Copy examination-service.jar to:" -ForegroundColor Red
  Write-Host "  $jar"
  Write-Host "or build it (needs Maven and internet):  cd $repo\examination-service ; mvn clean package -DskipTests"
  exit 1
}

# The keys are asked for here so nothing secret is stored in git.
# Leave a key empty to skip that feature (vessel checks or ownership screening then say "not configured").
if (-not $env:DATADOCKED_API_KEY) {
  $env:DATADOCKED_API_KEY = Read-Host "DataDocked API key (vessel checks; needs internet and credits)"
}
if (-not $env:OPENSANCTIONS_API_KEY) {
  $env:OPENSANCTIONS_API_KEY = Read-Host "OpenSanctions API key (vessel ownership screening; needs internet)"
}

Write-Host "Starting the examination service on port 8090. Leave this window open." -ForegroundColor Cyan
Set-Location "$repo\examination-service"
java -jar target\examination-service.jar
