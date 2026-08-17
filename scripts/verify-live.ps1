param(
  [string]$ApiBase = $(if ($env:ULTREIA_PUBLIC_API_BASE_URL) { $env:ULTREIA_PUBLIC_API_BASE_URL } else { 'https://api.ultreia.app/api' })
)

$ErrorActionPreference = 'Stop'
$base = $ApiBase.TrimEnd('/')
$uri = [Uri]$base
if ($uri.Scheme -ne 'https') { throw 'Live verification requires an HTTPS API URL.' }

Resolve-DnsName -Name $uri.Host -ErrorAction Stop | Out-Null

function Get-JsonEndpoint([string]$Path) {
  $target = "$base$Path"
  $watch = [Diagnostics.Stopwatch]::StartNew()
  $response = Invoke-WebRequest -Uri $target -UseBasicParsing -TimeoutSec 20
  $watch.Stop()
  [pscustomobject]@{ StatusCode = [int]$response.StatusCode; Milliseconds = $watch.ElapsedMilliseconds; Body = ($response.Content | ConvertFrom-Json) }
}

$health = Get-JsonEndpoint '/health'
$ready = Get-JsonEndpoint '/ready'
if ($health.StatusCode -ne 200 -or $health.Body.database.connected -ne $true) { throw 'Live health is not connected.' }
if ($ready.StatusCode -ne 200 -or $ready.Body.status -ne 'ready') { throw 'Live readiness is not ready.' }

[pscustomobject]@{
  status = 'verified'
  apiBase = $base
  health = @{ status = $health.StatusCode; databaseConnected = $health.Body.database.connected; milliseconds = $health.Milliseconds }
  ready = @{ status = $ready.StatusCode; state = $ready.Body.status; milliseconds = $ready.Milliseconds }
} | ConvertTo-Json -Depth 4
