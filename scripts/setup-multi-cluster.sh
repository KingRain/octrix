#!/bin/bash

set -e

echo "🚀 Setting up multi-cluster environment..."

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."
if ! command_exists minikube; then
    echo "❌ Error: minikube is not installed. Please install it first."
    exit 1
fi

if ! command_exists kubectl; then
    echo "❌ Error: kubectl is not installed. Please install it first."
    exit 1
fi

# Start Cluster 1
echo ""
echo "🔧 Setting up Cluster 1..."
minikube start --profile=cluster1 || echo "Cluster 1 may already be running"

# Deploy services to Cluster 1
echo "📦 Deploying services to Cluster 1..."
kubectl config use-context cluster1

kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: ott-platform
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: streaming-service
  namespace: ott-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: streaming-service
  template:
    metadata:
      labels:
        app: streaming-service
    spec:
      containers:
      - name: streaming-service
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 256Mi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cdn-cache
  namespace: ott-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cdn-cache
  template:
    metadata:
      labels:
        app: cdn-cache
    spec:
      containers:
      - name: cdn-cache
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 128Mi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: authentication
  namespace: ott-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: authentication
  template:
    metadata:
      labels:
        app: authentication
    spec:
      containers:
      - name: authentication
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 128Mi
EOF

# Start Cluster 2
echo ""
echo "🔧 Setting up Cluster 2..."
minikube start --profile=cluster2 || echo "Cluster 2 may already be running"

# Deploy services to Cluster 2
echo "📦 Deploying services to Cluster 2..."
kubectl config use-context cluster2

kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: ott-platform
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: streaming-service
  namespace: ott-platform
spec:
  replicas: 5
  selector:
    matchLabels:
      app: streaming-service
  template:
    metadata:
      labels:
        app: streaming-service
    spec:
      containers:
      - name: streaming-service
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 256Mi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cdn-cache
  namespace: ott-platform
spec:
  replicas: 4
  selector:
    matchLabels:
      app: cdn-cache
  template:
    metadata:
      labels:
        app: cdn-cache
    spec:
      containers:
      - name: cdn-cache
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 128Mi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: authentication
  namespace: ott-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: authentication
  template:
    metadata:
      labels:
        app: authentication
    spec:
      containers:
      - name: authentication
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 128Mi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: video-transcoder
  namespace: ott-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: video-transcoder
  template:
    metadata:
      labels:
        app: video-transcoder
    spec:
      containers:
      - name: video-transcoder
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
          limits:
            cpu: 800m
            memory: 512Mi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: recommendation-engine
  namespace: ott-platform
spec:
  replicas: 4
  selector:
    matchLabels:
      app: recommendation-engine
  template:
    metadata:
      labels:
        app: recommendation-engine
    spec:
      containers:
      - name: recommendation-engine
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 150m
            memory: 192Mi
          limits:
            cpu: 600m
            memory: 384Mi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notifications
  namespace: ott-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: notifications
  template:
    metadata:
      labels:
        app: notifications
    spec:
      containers:
      - name: notifications
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 128Mi
EOF

echo ""
echo "✅ Multi-cluster setup complete!"
echo ""
echo "📊 Cluster Status:"
echo "Cluster 1: $(minikube status --profile=cluster1 | head -1)"
echo "Cluster 2: $(minikube status --profile=cluster2 | head -1)"
echo ""
echo "📋 Next Steps:"
echo "1. Start Prometheus port forwarding:"
echo "   Terminal 1: kubectl port-forward --context=minikube-cluster1 -n monitoring svc/prometheus-server 9090:80"
echo "   Terminal 2: kubectl port-forward --context=minikube-cluster2 -n monitoring svc/prometheus-server 9091:80"
echo ""
echo "2. Restart the backend server to pick up the new cluster configuration"
echo ""
echo "3. Open the frontend and use the cluster selector to switch between clusters"
