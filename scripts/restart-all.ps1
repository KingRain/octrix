# Octrix Restart Script
# This script terminates all running sessions and restarts everything

Write-Host "=== Octrix Restart Script ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill all Node.js processes
Write-Host "[1/5] Terminating Node.js processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "  Terminated $($nodeProcesses.Count) Node.js process(es)" -ForegroundColor Green
} else {
    Write-Host "  No Node.js processes found" -ForegroundColor Gray
}

# Step 2: Kill any existing kubectl port-forward
Write-Host "[2/5] Terminating kubectl port-forward processes..." -ForegroundColor Yellow
$kubectlProcesses = Get-Process -Name "kubectl" -ErrorAction SilentlyContinue
if ($kubectlProcesses) {
    $kubectlProcesses | Stop-Process -Force
    Write-Host "  Terminated $($kubectlProcesses.Count) kubectl process(es)" -ForegroundColor Green
} else {
    Write-Host "  No kubectl processes found" -ForegroundColor Gray
}

# Wait a moment for processes to fully terminate
Start-Sleep -Seconds 2

# Step 3: Check Minikube status and start if needed
Write-Host "[3/5] Checking Minikube status..." -ForegroundColor Yellow
$minikubeStatus = minikube status --format='{{.Host}}' 2>$null
if ($minikubeStatus -ne "Running") {
    Write-Host "  Starting Minikube..." -ForegroundColor Yellow
    minikube start
} else {
    Write-Host "  Minikube is already running" -ForegroundColor Green
}

# Step 4: Start Prometheus port-forward in background
Write-Host "[4/5] Starting Prometheus port-forward..." -ForegroundColor Yellow
$prometheusJob = Start-Job -ScriptBlock {
    kubectl port-forward svc/prometheus-server 9090:80 -n monitoring 2>&1
}
Write-Host "  Prometheus port-forward started (Job ID: $($prometheusJob.Id))" -ForegroundColor Green

# Wait for port-forward to establish
Start-Sleep -Seconds 3

# Step 5: Start Backend and Frontend
Write-Host "[5/5] Starting Backend and Frontend..." -ForegroundColor Yellow

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $projectRoot) {
    $projectRoot = "c:\Users\samjo\OneDrive\Documents\ProjectFiles\octrix"
}

# Start Backend
Write-Host "  Starting Backend..." -ForegroundColor Yellow
$backendPath = Join-Path $projectRoot "backend"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$backendPath`" && npm run dev" -WindowStyle Normal

# Wait for backend to start
Start-Sleep -Seconds 5

# Start Frontend
Write-Host "  Starting Frontend..." -ForegroundColor Yellow
$frontendPath = Join-Path $projectRoot "frontend"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$frontendPath`" && npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "=== All services started! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  - Frontend:   http://localhost:3000" -ForegroundColor White
Write-Host "  - Backend:    http://localhost:3001" -ForegroundColor White
Write-Host "  - Prometheus: http://localhost:9090" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit (services will continue running)..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
