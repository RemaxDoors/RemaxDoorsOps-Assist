# Startup for a Windows host (IIS reverse proxy or NSSM service).
$ErrorActionPreference = "Stop"

$env:NODE_ENV = "production"
if (-not $env:PORT) { $env:PORT = "4080" }

Write-Host "Operation Help starting on port $($env:PORT)"

if (-not (Test-Path ".next")) {
  Write-Error "'.next' is missing. Run 'npm run build' before deploying."
  exit 1
}

npx next start
