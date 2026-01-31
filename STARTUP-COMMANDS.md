# Startup Commands for Multi-Cluster Setup

## Prerequisites
- Minikube installed
- kubectl installed
- Node.js and npm installed

## Step 1: Start Minikube Clusters

### Start Cluster 1
```bash
minikube start --profile=cluster1
```

### Start Cluster 2
```bash
minikube start --profile=cluster2
```

## Step 2: Deploy Sample Pods to Each Cluster

### Deploy pods to Cluster 1
```bash
kubectl config use-context cluster1
kubectl apply --validate=false -f k8s/cluster1-deployments.yaml
```

### Deploy pods to Cluster 2
```bash
kubectl config use-context cluster2
kubectl apply --validate=false -f k8s/cluster2-deployments.yaml
```

## Step 3: Deploy Prometheus to Each Cluster

### Deploy Prometheus to Cluster 1
```bash
kubectl config use-context cluster1
kubectl create namespace monitoring
kubectl apply -f https://raw.githubusercontent.com/prometheus-operator/prometheus-operator/main/bundle.yaml
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: prometheus-server
  namespace: monitoring
spec:
  selector:
    app.kubernetes.io/name: prometheus
  ports:
  - port: 80
    targetPort: 9090
  type: ClusterIP
EOF
```

### Deploy Prometheus to Cluster 2
```bash
kubectl config use-context cluster2
kubectl create namespace monitoring
kubectl apply -f https://raw.githubusercontent.com/prometheus-operator/prometheus-operator/main/bundle.yaml
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: prometheus-server
  namespace: monitoring
spec:
  selector:
    app.kubernetes.io/name: prometheus
  ports:
  - port: 80
    targetPort: 9090
  type: ClusterIP
EOF
```

## Step 4: Start Prometheus Port Forwarding

### Start port forwarding for Cluster 1 (Terminal 3)
```bash
kubectl port-forward --context=cluster1 -n monitoring svc/prometheus-server 9090:80
```

### Start port forwarding for Cluster 2 (Terminal 4)
```bash
kubectl port-forward --context=cluster2 -n monitoring svc/prometheus-server 9091:80
```

## Step 5: Start Backend and Frontend

### Start Backend (Terminal 1)
```bash
cd backend
npm run dev
```

### Start Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```

## Verify Setup

### Check Cluster 1 Status
```bash
kubectl config use-context cluster1
kubectl get nodes
kubectl top nodes
kubectl get pods -n ott-platform
```

### Check Cluster 2 Status
```bash
kubectl config use-context cluster2
kubectl get nodes
kubectl top nodes
kubectl get pods -n ott-platform
```

## Access the Application

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Prometheus Cluster 1: http://localhost:9090
- Prometheus Cluster 2: http://localhost:9091

## Notes

- The backend now fetches real node metrics from each cluster using kubectl
- Each cluster will show one node with real CPU, RAM, and pod count data
- The cluster dropdown in the overview page switches the Service Pod Status container
- The Node Resources section shows static containers for Node 1 (Cluster 1) and Node 2 (Cluster 2)
- Prometheus is deployed to both clusters on ports 9090 and 9091 respectively
