$ErrorActionPreference = 'Stop'
$env:ULTREIA_MODE = 'lan'
$env:NODE_ENV = 'development'
Write-Host "Ultreia LAN backend: http://0.0.0.0:3000/api"
Write-Host "Mobile API URL wird aus der lokalen IPv4-Adresse durch mobile/scripts/start-lan.ps1 gesetzt."
npm --prefix backend start
