# Marketer Pro — dev startup script
# Run from the repo root: .\start-dev.ps1

$root   = $PWD.Path
$loader = Join-Path $root "_env-loader.ps1"

# Load .env into this session
. $loader
Write-Host ".env loaded" -ForegroundColor Green

Write-Host "Building API..." -ForegroundColor Cyan
npm run build -w @home-link/marketer-pro-contract
npm run build -w @home-link/marketer-api

Write-Host "Starting servers..." -ForegroundColor Cyan

# Web UI — http://localhost:5173
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; . '$loader'; npm run dev -w apps/web"

# API servers
$servers = @(
  @{ name="brand";      cmd="npm run start:brand-profile -w @home-link/marketer-api" },
  @{ name="campaign";   cmd="npm run start:campaign -w @home-link/marketer-api" },
  @{ name="auth";       cmd="npm run start:auth -w @home-link/marketer-api" },
  @{ name="viral";      cmd="npm run start:viral -w @home-link/marketer-api" },
  @{ name="analytics";  cmd="npm run start:analytics -w @home-link/marketer-api" },
  @{ name="sentiment";  cmd="npm run start:sentiment -w @home-link/marketer-api" },
  @{ name="predictive"; cmd="npm run start:predictive -w @home-link/marketer-api" },
  @{ name="autonomous"; cmd="npm run start:autonomous -w @home-link/marketer-api" },
  @{ name="team";       cmd="npm run start:team -w @home-link/marketer-api" },
  @{ name="safety";     cmd="npm run start:safety -w @home-link/marketer-api" }
)

foreach ($s in $servers) {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; . '$loader'; $($s.cmd)"
  Write-Host "  started: $($s.name)" -ForegroundColor Green
  Start-Sleep -Milliseconds 300
}

Write-Host ""
Write-Host "All servers starting. Open http://localhost:5173" -ForegroundColor Yellow
