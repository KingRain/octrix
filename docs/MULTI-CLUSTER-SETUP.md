# Multi-Cluster Setup Guide

This guide explains how to set up two minikube instances with different service configurations and manage them through the Octrix platform.

## Prerequisites

- Minikube installed
- kubectl installed
- Node.js 18+ installed
- Docker installed

## Quick Setup

Run the automated setup script:

```bash
cd scripts
bash setup-multi-cluster.sh
```

## Manual Setup

### Step 1: Start First Minikube Instance

```bash
# Start first minikube instance
minikube start --profile=cluster1

# Verify it's running
minikube status --profile=cluster1
```

### Step 2: Deploy Services to First Cluster

The first cluster will have the standard OTT platform services:

```bash
# Switch to cluster1 context
kubectl config use-context cluster1

# Create namespace and deploy services
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
```

### Step 3: Start Second Minikube Instance

```bash
# Start second minikube instance
minikube start --profile=cluster2

# Verify it's running
minikube status --profile=cluster2
```

### Step 4: Deploy More Services to Second Cluster

The second cluster will have more services and pods:

```bash
# Switch to cluster2 context
kubectl config use-context cluster2

# Deploy additional services with more replicas
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
```

### Step 5: Verify Clusters

```bash
# Check cluster1
kubectl config use-context cluster1
kubectl get pods -n ott-platform

# Check cluster2
kubectl config use-context cluster2
kubectl get pods -n ott-platform
```

### Step 6: Start Prometheus Port Forwarding

```bash
# For cluster1 (Terminal 1)
kubectl port-forward --context=cluster1 -n monitoring svc/prometheus-server 9090:80

# For cluster2 (Terminal 2)
kubectl port-forward --context=cluster2 -n monitoring svc/prometheus-server 9091:80
```

**Note**: If you don't have Prometheus installed, you can skip this step. The backend will still work but won't show metrics.

### Step 7: Restart Backend

```bash
# Stop backend
cd backend
npm run stop

# Start backend
npm run start
```

### Step 8: Test Multi-Cluster Support

1. Open the frontend application
2. Navigate to the Overview page
3. Use the cluster selector dropdown to switch between clusters
4. Navigate to the Nodes page and verify cluster switching works there too

## Verification

### Cluster 1
- Should show 3 services
- Fewer pods per service
- Standard resource allocation

### Cluster 2
- Should show 6 services
- More pods per service
- Higher resource allocation for services like video-transcoder and recommendation-engine

## Troubleshooting

### Clusters not showing in dropdown
- Verify backend configuration includes both clusters
- Check backend logs for cluster manager errors
- Ensure Prometheus URLs are correct

### Data not updating when switching clusters
- Check if cluster switching API is working: `curl http://localhost:3001/api/v1/cluster/clusters`
- Verify cluster manager is correctly setting current cluster
- Check backend logs for cluster context errors

### Services not visible in overview
- Verify pods are running: `kubectl get pods --context=cluster2 -n ott-platform`
- Check Prometheus is scraping metrics from the correct cluster
- Ensure kubeconfig path and context are correct in cluster configuration

## Next Steps

1. Add cluster health monitoring
2. Implement cluster-specific alerts
3. Add cluster comparison views
4. Create cluster management UI (add/remove clusters)
