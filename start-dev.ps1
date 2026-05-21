# Marketer Pro — dev startup script
# Run from the repo root: .\start-dev.ps1

$root   = $PWD.Path
$loader = Join-Path $root "_env-loader.ps1"

# Load .env into this session
. $loader
Write-Host ".env loaded" -ForegroundColor Green

# Ensure Redis + Postgres are running via Docker
Write-Host "Starting infrastructure (Redis + Postgres)..." -ForegroundColor Cyan
docker compose up -d
Write-Host "  Redis:    localhost:6379" -ForegroundColor Green
Write-Host "  Postgres: localhost:5432" -ForegroundColor Green

Write-Host "Building packages..." -ForegroundColor Cyan
npm run build -w @home-link/marketer-pro-contract
npm run build -w @home-link/marketer-api
npm run build -w @home-link/marketer-pro-queue

Write-Host "Running DB migrations..." -ForegroundColor Cyan
npm run db:migrate

Write-Host "Starting servers..." -ForegroundColor Cyan

# Web UI — http://localhost:5173
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; . '$loader'; npm run dev -w apps/web"
Write-Host "  started: web-ui  (http://localhost:5173)" -ForegroundColor Green

# BullMQ publish queue worker (requires Redis)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; . '$loader'; npm run queue:worker"
Write-Host "  started: queue-worker  (Redis BullMQ publish worker)" -ForegroundColor Green
Start-Sleep -Milliseconds 500

# API servers
$servers = @(
  @{ name="auth";        port=8790; cmd="npm run start:auth -w @home-link/marketer-api" },
  @{ name="scheduler";   port=8791; cmd="npm run start:scheduler -w @home-link/marketer-api" },
  @{ name="generation";  port=8792; cmd="npm run start:generation -w @home-link/marketer-api" },
  @{ name="campaign";    port=8793; cmd="npm run start:campaign -w @home-link/marketer-api" },
  @{ name="brand";       port=8794; cmd="npm run start:brand-profile -w @home-link/marketer-api" },
  @{ name="analytics";   port=8795; cmd="npm run start:analytics -w @home-link/marketer-api" },
  @{ name="sentiment";   port=8796; cmd="npm run start:sentiment -w @home-link/marketer-api" },
  @{ name="team";        port=8797; cmd="npm run start:team -w @home-link/marketer-api" },
  @{ name="autonomous";  port=8805; cmd="npm run start:autonomous -w @home-link/marketer-api" },
  @{ name="predictive";  port=8806; cmd="npm run start:predictive -w @home-link/marketer-api" },
  @{ name="safety";      port=8807; cmd="npm run start:safety -w @home-link/marketer-api" },
  @{ name="viral";       port=8808; cmd="npm run start:viral -w @home-link/marketer-api" },
  @{ name="brand-memory";port=8809; cmd="npm run start:brand-memory -w @home-link/marketer-api" },
  @{ name="social-oauth";port=8810; cmd="npm run start:social-oauth -w @home-link/marketer-api" }
)

foreach ($s in $servers) {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; . '$loader'; $($s.cmd)"
  Write-Host "  started: $($s.name)  (port $($s.port))" -ForegroundColor Green
  Start-Sleep -Milliseconds 300
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  All systems starting." -ForegroundColor Yellow
Write-Host "  Web UI:         http://localhost:5173" -ForegroundColor Yellow
Write-Host "  Auth API:       http://localhost:8790" -ForegroundColor Yellow
Write-Host "  Autonomous:     http://localhost:8805" -ForegroundColor Yellow
Write-Host "  Queue worker:   Redis BullMQ (live)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
