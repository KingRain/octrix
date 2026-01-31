# Octrix Minikube Setup Script for Windows PowerShell

$ErrorActionPreference = "Stop"

Write-Host "=== Octrix Minikube Setup Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if minikube is installed
if (-not (Get-Command minikube -ErrorAction SilentlyContinue)) {
    Write-Host "Error: minikube is not installed. Please install it first." -ForegroundColor Red
    Write-Host "Visit: https://minikube.sigs.k8s.io/docs/start/"
    exit 1
}

# Check if kubectl is installed
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    Write-Host "Error: kubectl is not installed. Please install it first." -ForegroundColor Red
    Write-Host "Visit: https://kubernetes.io/docs/tasks/tools/"
    exit 1
}

# Start minikube with recommended settings
Write-Host "Starting Minikube cluster..." -ForegroundColor Yellow
minikube start `
    --cpus=4 `
    --memory=8192 `
    --disk-size=40g `
    --driver=docker `
    --kubernetes-version=v1.28.0

Write-Host ""
Write-Host "Enabling required addons..." -ForegroundColor Yellow
minikube addons enable metrics-server
minikube addons enable dashboard

Write-Host ""
Write-Host "Creating namespaces..." -ForegroundColor Yellow
kubectl apply -f "$PSScriptRoot\..\k8s\namespace.yaml"

Write-Host ""
Write-Host "Deploying Prometheus stack..." -ForegroundColor Yellow
kubectl apply -f "$PSScriptRoot\..\k8s\prometheus\prometheus-config.yaml"
kubectl apply -f "$PSScriptRoot\..\k8s\prometheus\prometheus-deployment.yaml"
kubectl apply -f "$PSScriptRoot\..\k8s\prometheus\kube-state-metrics.yaml"
kubectl apply -f "$PSScriptRoot\..\k8s\prometheus\node-exporter.yaml"

Write-Host ""
Write-Host "Waiting for Prometheus to be ready..." -ForegroundColor Yellow
kubectl wait --for=condition=available --timeout=120s deployment/prometheus -n monitoring
kubectl wait --for=condition=available --timeout=120s deployment/kube-state-metrics -n monitoring

Write-Host ""
Write-Host "Deploying sample applications for testing..." -ForegroundColor Yellow
kubectl apply -f "$PSScriptRoot\..\k8s\sample-apps\sample-deployment.yaml"

Write-Host ""
Write-Host "Waiting for sample apps to be ready..." -ForegroundColor Yellow
kubectl wait --for=condition=available --timeout=60s deployment/nginx-demo -n sample-apps
kubectl wait --for=condition=available --timeout=60s deployment/redis-demo -n sample-apps

$minikubeIp = minikube ip

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Access points:" -ForegroundColor Cyan
Write-Host "  - Prometheus: http://${minikubeIp}:30090"
Write-Host "  - Minikube Dashboard: minikube dashboard"
Write-Host ""
Write-Host "To deploy Octrix backend:" -ForegroundColor Cyan
Write-Host "  1. Build the Docker image: docker build -t octrix-backend:latest ./backend"
Write-Host "  2. Load into minikube: minikube image load octrix-backend:latest"
Write-Host "  3. Deploy: kubectl apply -f k8s/octrix/backend-deployment.yaml"
Write-Host ""
Write-Host "Or run the backend locally with:" -ForegroundColor Cyan
Write-Host "  cd backend; npm run dev"
Write-Host ""
Write-Host "Set PROMETHEUS_URL=http://${minikubeIp}:30090 in your .env file" -ForegroundColor Yellow
