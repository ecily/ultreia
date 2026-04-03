param(
  [string]$ApiBase = "https://lobster-app-ie9a5.ondigitalocean.app"
)

$ErrorActionPreference = "Stop"

function Test-Endpoint {
  param(
    [string]$Name,
    [string]$Url,
    [int[]]$ExpectedStatus = @(200)
  )

  try {
    $code = & curl.exe -s -o NUL -w "%{http_code}" -L --max-redirs 0 $Url
    $status = [int]$code
    $ok = $ExpectedStatus -contains $status
    [PSCustomObject]@{
      Name = $Name
      Url = $Url
      Status = $status
      Error = ""
      Pass = $ok
    }
  } catch {
    [PSCustomObject]@{
      Name = $Name
      Url = $Url
      Status = -1
      Error = $_.Exception.Message
      Pass = $false
    }
  }
}

$api = $ApiBase.TrimEnd("/")

$tests = @(
  @{ Name = "health"; Url = "$api/api/health"; Status = @(200) },
  @{ Name = "ping"; Url = "$api/api/ping"; Status = @(200) },
  @{ Name = "readyz"; Url = "$api/api/_readyz"; Status = @(200) },
  @{ Name = "apk redirect"; Url = "$api/apk"; Status = @(301,302,307,308) }
)

$results = foreach ($t in $tests) {
  Test-Endpoint -Name $t.Name -Url $t.Url -ExpectedStatus $t.Status
}

$results | Select-Object Name,Url,Status,Pass,Error | Format-Table -AutoSize

$failed = @($results | Where-Object { -not $_.Pass })
if ($failed.Count -gt 0) {
  Write-Host ""
  Write-Host "Smoke result: FAIL ($($failed.Count) checks failed)." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Smoke result: PASS." -ForegroundColor Green
exit 0
