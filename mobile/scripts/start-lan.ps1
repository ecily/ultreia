$ErrorActionPreference = 'Stop'

$addresses = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
  Where-Object {
    $_.IPAddress -notlike '127.*' -and
    $_.IPAddress -notlike '169.254.*' -and
    $_.PrefixOrigin -in @('Dhcp', 'Manual') -and
    (($_.IPAddress -like '10.*') -or ($_.IPAddress -like '192.168.*') -or ($_.IPAddress -match '^172\.(1[6-9]|2[0-9]|3[0-1])\.'))
  } |
  Sort-Object InterfaceIndex, IPAddress)

if ($addresses.Count -eq 0) { throw 'Keine private lokale IPv4-Adresse gefunden.' }
$ip = $addresses[0].IPAddress
$env:ULTREIA_MODE = 'lan'
$env:EXPO_PUBLIC_API_BASE_URL = "http://$ip`:3000/api"
Write-Host "Ultreia LAN mobile API: $env:EXPO_PUBLIC_API_BASE_URL"
Write-Host 'Zuerst in einem zweiten Terminal `npm run lan:backend` starten.'
Set-Location (Join-Path $PSScriptRoot '..')
npx expo start --lan
