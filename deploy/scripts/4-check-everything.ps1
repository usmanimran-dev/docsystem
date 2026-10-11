function Probe($name, $port) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$port" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    $code = $r.StatusCode
  } catch {
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode } else { $code = $null }
  }
  if ($code) { Write-Host ("{0,-22} port {1}  UP  (HTTP {2})" -f $name, $port, $code) -ForegroundColor Green }
  else       { Write-Host ("{0,-22} port {1}  DOWN" -f $name, $port) -ForegroundColor Red }
}

Probe "Angular app" 4200
Probe "DMS backend" 8082
Probe "Examination service" 8090

Write-Host ""
try {
  $body = '{"loginid":"admin","password":"admin123"}'
  $r = Invoke-RestMethod -Uri "http://localhost:8082/login" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 8
  Write-Host "Admin login: OK" -ForegroundColor Green
} catch { Write-Host "Admin login: FAILED ($($_.Exception.Message))" -ForegroundColor Red }

try {
  $c = Invoke-RestMethod -Uri "http://localhost:8090/compliance/countries" -TimeoutSec 8
  Write-Host ("Compliance countries loaded: {0}" -f @($c).Count) -ForegroundColor Green
} catch { Write-Host "Compliance countries: FAILED" -ForegroundColor Red }

try {
  $p = Invoke-RestMethod -Uri "http://localhost:8090/compliance/ports" -TimeoutSec 8
  Write-Host ("Compliance ports loaded: {0}" -f @($p).Count) -ForegroundColor Green
} catch { Write-Host "Compliance ports: FAILED" -ForegroundColor Red }

Write-Host ""
Write-Host "Expected: Angular 200, DMS 400, Examination service 404 (those are the normal root responses)."
