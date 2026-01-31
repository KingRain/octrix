#!/bin/bash

set -e

echo "=== Octrix Minikube Setup Script ==="
echo ""

# Check if minikube is installed
if ! command -v minikube &> /dev/null; then
    echo "Error: minikube is not installed. Please install it first."
    echo "Visit: https://minikube.sigs.k8s.io/docs/start/"
    exit 1
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "Error: kubectl is not installed. Please install it first."
    echo "Visit: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

# Start minikube with recommended settings
echo "Starting Minikube cluster..."
minikube start \
    --cpus=4 \
    --memory=8192 \
    --disk-size=40g \
    --driver=docker \
    --kubernetes-version=v1.28.0 \
    --addons=metrics-server

echo ""
echo "Enabling required addons..."
minikube addons enable metrics-server
minikube addons enable dashboard

echo ""
echo "Creating namespaces..."
kubectl apply -f ../k8s/namespace.yaml

echo ""
echo "Deploying Prometheus stack..."
kubectl apply -f ../k8s/prometheus/prometheus-config.yaml
kubectl apply -f ../k8s/prometheus/prometheus-deployment.yaml
kubectl apply -f ../k8s/prometheus/kube-state-metrics.yaml
kubectl apply -f ../k8s/prometheus/node-exporter.yaml

echo ""
echo "Waiting for Prometheus to be ready..."
kubectl wait --for=condition=available --timeout=120s deployment/prometheus -n monitoring
kubectl wait --for=condition=available --timeout=120s deployment/kube-state-metrics -n monitoring

echo ""
echo "Deploying sample applications for testing..."
kubectl apply -f ../k8s/sample-apps/sample-deployment.yaml

echo ""
echo "Waiting for sample apps to be ready..."
kubectl wait --for=condition=available --timeout=60s deployment/nginx-demo -n sample-apps
kubectl wait --for=condition=available --timeout=60s deployment/redis-demo -n sample-apps

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Access points:"
echo "  - Prometheus: http://$(minikube ip):30090"
echo "  - Minikube Dashboard: minikube dashboard"
echo ""
echo "To deploy Octrix backend:"
echo "  1. Build the Docker image: docker build -t octrix-backend:latest ./backend"
echo "  2. Load into minikube: minikube image load octrix-backend:latest"
echo "  3. Deploy: kubectl apply -f k8s/octrix/backend-deployment.yaml"
echo ""
echo "Or run the backend locally with:"
echo "  cd backend && npm run dev"
echo ""
echo "Set PROMETHEUS_URL=http://$(minikube ip):30090 in your .env file"
