# Octrix Startup Guide

Complete guide to start all components of the Octrix platform.

## Prerequisites

- Node.js 18+
- npm
- Docker Desktop
- Minikube
- kubectl

---

## Quick Start (All Components)

### Option 1: Using Setup Script (Recommended)

```bash
# Windows PowerShell
.\scripts\setup-minikube.ps1

# Linux/Mac
./scripts/setup-minikube.sh
```

This script will:
- Start Minikube cluster with optimal settings
- Deploy Prometheus, kube-state-metrics, and node-exporter
- Deploy sample applications
- Provide access URLs

---

## Manual Startup Guide

### 1. Start Minikube Cluster

```bash
minikube start \
    --cpus=4 \
    --memory=8192 \
    --disk-size=40g \
    --driver=docker \
    --kubernetes-version=v1.28.0 \
    --addons=metrics-server
```

Enable required addons:
```bash
minikube addons enable metrics-server
minikube addons enable dashboard
```

### 2. Create Namespaces

```bash
kubectl apply -f k8s/namespace.yaml
```

### 3. Deploy Prometheus Stack

```bash
# Apply Prometheus configuration
kubectl apply -f k8s/prometheus/prometheus-config.yaml

# Deploy Prometheus
kubectl apply -f k8s/prometheus/prometheus-deployment.yaml

# Deploy kube-state-metrics
kubectl apply -f k8s/prometheus/kube-state-metrics.yaml

# Deploy node-exporter
kubectl apply -f k8s/prometheus/node-exporter.yaml
```

Wait for Prometheus to be ready:
```bash
kubectl wait --for=condition=available --timeout=120s deployment/prometheus -n monitoring
kubectl wait --for=condition=available --timeout=120s deployment/kube-state-metrics -n monitoring
```

### 4. Deploy Sample Applications

```bash
kubectl apply -f k8s/sample-apps/sample-deployment.yaml
```

Wait for sample apps:
```bash
kubectl wait --for=condition=available --timeout=60s deployment/nginx-demo -n sample-apps
kubectl wait --for=condition=available --timeout=60s deployment/redis-demo -n sample-apps
```

### 5. Deploy Octrix Backend (Optional - in-cluster)

```bash
# Build Docker image
docker build -t octrix-backend:latest ./backend

# Load image into Minikube
minikube image load octrix-backend:latest

# Deploy to Kubernetes
kubectl apply -f k8s/octrix/backend-deployment.yaml
```

### 6. Deploy Octrix Frontend (Optional - in-cluster)

```bash
# Build Docker image
docker build -t octrix-frontend:latest ./frontend

# Load image into Minikube
minikube image load octrix-frontend:latest

# Deploy to Kubernetes
kubectl apply -f k8s/octrix/frontend-deployment.yaml
```

### 7. Start Backend Locally (Development Mode)

```bash
cd backend
npm install
cp .env.example .env

# Get Minikube IP for PROMETHEUS_URL
minikube ip
# Update .env with: PROMETHEUS_URL=http://<MINIKUBE_IP>:30090

npm run dev
```

Backend will be available at: `http://localhost:3001`

### 8. Start Frontend Locally (Development Mode)

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at: `http://localhost:3000`

---

## Port Forwarding

### Prometheus Port Forward

```bash
# Forward Prometheus to localhost:9090
kubectl port-forward -n monitoring deployment/prometheus 9090:9090
```

Access Prometheus at: `http://localhost:9090`

### Backend Port Forward (if deployed in cluster)

```bash
# Forward backend to localhost:3001
kubectl port-forward -n octrix deployment/octrix-backend 3001:3001
```

### Frontend Port Forward (if deployed in cluster)

```bash
# Forward frontend to localhost:3000
kubectl port-forward -n octrix deployment/octrix-frontend 3000:3000
```

---

## Access URLs

### Local Development

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Prometheus**: http://localhost:9090 (with port-forward)

### Minikube NodePort Access

Get Minikube IP:
```bash
minikube ip
```

- **Frontend**: http://<MINIKUBE_IP>:30000
- **Backend**: http://<MINIKUBE_IP>:30001
- **Prometheus**: http://<MINIKUBE_IP>:30090

### Minikube Dashboard

```bash
minikube dashboard
```

---

## Verify Deployment

### Check All Pods

```bash
# All namespaces
kubectl get pods -A

# Specific namespace
kubectl get pods -n monitoring
kubectl get pods -n octrix
kubectl get pods -n sample-apps
```

### Check Services

```bash
kubectl get svc -A
```

### Check Deployments

```bash
kubectl get deployments -A
```

### Check Prometheus Connection

```bash
# Check Prometheus health
curl http://localhost:9090/-/healthy

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets
```

---

## Useful Commands

### View Logs

```bash
# Backend logs
kubectl logs -f deployment/octrix-backend -n octrix

# Frontend logs
kubectl logs -f deployment/octrix-frontend -n octrix

# Prometheus logs
kubectl logs -f deployment/prometheus -n monitoring
```

### Restart Services

```bash
# Restart backend
kubectl rollout restart deployment/octrix-backend -n octrix

# Restart frontend
kubectl rollout restart deployment/octrix-frontend -n octrix

# Restart Prometheus
kubectl rollout restart deployment/prometheus -n monitoring
```

### Scale Deployments

```bash
# Scale backend to 3 replicas
kubectl scale deployment/octrix-backend -n octrix --replicas=3

# Scale frontend to 2 replicas
kubectl scale deployment/octrix-frontend -n octrix --replicas=2
```

### Delete All Resources

```bash
# Delete Octrix deployments
kubectl delete -f k8s/octrix/backend-deployment.yaml
kubectl delete -f k8s/octrix/frontend-deployment.yaml

# Delete Prometheus stack
kubectl delete -f k8s/prometheus/

# Delete sample apps
kubectl delete -f k8s/sample-apps/sample-deployment.yaml

# Stop Minikube
minikube stop
```

---

## Environment Variables

### Backend (.env)

```env
PORT=3001
NODE_ENV=development
PROMETHEUS_URL=http://localhost:9090
PROMETHEUS_SCRAPE_INTERVAL=15000
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=your-jwt-secret
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Troubleshooting

### Minikube Issues

```bash
# Check Minikube status
minikube status

# Delete and restart Minikube
minikube delete
minikube start --cpus=4 --memory=8192 --driver=docker
```

### Pod Not Starting

```bash
# Check pod events
kubectl describe pod <pod-name> -n <namespace>

# Check pod logs
kubectl logs <pod-name> -n <namespace>

# Check resource usage
kubectl top pods -A
```

### Prometheus Not Scraping Metrics

```bash
# Check Prometheus targets
kubectl port-forward -n monitoring deployment/prometheus 9090:9090
# Open http://localhost:9090/targets

# Check Prometheus configuration
kubectl get configmap prometheus-config -n monitoring -o yaml
```

---

## Development Workflow

### Typical Development Session

```bash
# Terminal 1: Start Minikube and Prometheus
minikube start
kubectl apply -f k8s/prometheus/prometheus-config.yaml
kubectl apply -f k8s/prometheus/prometheus-deployment.yaml
kubectl apply -f k8s/prometheus/kube-state-metrics.yaml
kubectl apply -f k8s/prometheus/node-exporter.yaml

# Terminal 2: Start Backend
cd backend
cp .env.example .env
# Update PROMETHEUS_URL with minikube ip
npm run dev

# Terminal 3: Start Frontend
cd frontend
npm run dev

# Terminal 4: Port forward Prometheus (optional)
kubectl port-forward -n monitoring deployment/prometheus 9090:9090
```

---

## Production Deployment

For production deployment, refer to the main README.md for:
- Docker image building and pushing
- Kubernetes deployment configurations
- Ingress setup
- SSL/TLS configuration
- High availability setup
