# Start the DivyaDrishti bridge for a demo: fresh database with the 11 synthetic
# cases, listening on all interfaces so a phone on the same Wi-Fi can reach it.
# Usage (from the repo root):  powershell -ExecutionPolicy Bypass -File tools\run_demo.ps1
param([int]$Port = 8000)
$root = Split-Path $PSScriptRoot -Parent
$env:DD_DB = Join-Path $env:TEMP ("divyadrishti-demo-{0}.db" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' -and $_.IPAddress -notmatch '^169\.' } |
  Select-Object -First 1).IPAddress
Write-Host ""
Write-Host "  Laptop (portal):  http://localhost:$Port/portal.html"
Write-Host "  Phone, same Wi-Fi: http://${ip}:$Port   (mic/camera need HTTPS: use a tunnel or the Chrome flag, see docs/PHONE_DEMO_SETUP.md)"
Write-Host "  Database:          $env:DD_DB"
Write-Host ""
Set-Location $root
& "$root\.venv\Scripts\python.exe" -m uvicorn server.app:app --host 0.0.0.0 --port $Port
