$ErrorActionPreference = 'Stop'
$env:ULTREIA_MODE = 'production'
$env:EXPO_PUBLIC_API_BASE_URL = 'https://api.ultreia.app/api'
npm ci --ignore-scripts --no-audit --no-fund
npx expo prebuild --platform android --no-install
Push-Location (Join-Path $PSScriptRoot '..\android')
try { .\gradlew.bat clean assembleRelease --no-daemon --console=plain --max-workers=2 }
finally { Pop-Location }
