param(
  [string]$RepoRoot = "c:\coding\stepsmatch"
)

$ErrorActionPreference = "Stop"

function Run-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )
  Write-Host ""
  Write-Host "==> $Name" -ForegroundColor Cyan
  & $Action
  Write-Host "PASS: $Name" -ForegroundColor Green
}

Run-Step -Name "Backend syntax check" -Action {
  node --check "$RepoRoot\\backend\\server.js"
}

Run-Step -Name "Frontend lint" -Action {
  npm -C "$RepoRoot\\frontend" run lint
}

Run-Step -Name "Frontend build" -Action {
  npm -C "$RepoRoot\\frontend" run build
}

Run-Step -Name "Mobile lint" -Action {
  npm -C "$RepoRoot\\mobile" run lint
}

Write-Host ""
Write-Host "All local release checks passed." -ForegroundColor Green
