# Octrix Backend Architecture

## Overview

The Octrix backend is built around Kubernetes using Minikube for local development, with kubectl for cluster interaction. It integrates with Prometheus for metrics collection, using kube-state-metrics and node-exporter for cluster and node-level signals.

## Core Responsibilities

1. **Metrics Collection** - Collect metrics from Prometheus, kube-state-metrics, and node-exporter
2. **Incident Detection** - Detect anomalies and classify severity
3. **Auto-Healing** - Trigger automatic remediation for low-severity issues
4. **Escalation** - Escalate high-severity incidents for manual intervention
5. **API Exposure** - Provide clean REST APIs for frontend consumption
6. **Failure Simulation** - Support locally simulated failures for the Simulator page

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Octrix Backend                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Prometheus │  │  Incident   │  │  Simulator  │             │
│  │   Service   │  │   Service   │  │   Service   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐             │
│  │  Kubernetes │  │   Healing   │  │   Socket.IO │             │
│  │   Service   │  │   Service   │  │  Real-time  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster (Minikube)                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Prometheus │  │ kube-state- │  │    node-    │             │
│  │             │  │   metrics   │  │   exporter  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Application Pods                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Services

### Prometheus Service (`prometheus.service.ts`)

Handles all communication with Prometheus for metrics collection.

**Features:**
- Query Prometheus API for instant and range queries
- Collect node metrics (CPU, memory, disk, network)
- Collect pod metrics (CPU, memory, restarts)
- Collect cluster-wide metrics
- Fallback to mock data when Prometheus is unavailable

**Key Methods:**
- `getNodeMetrics()` - Get metrics for all nodes
- `getPodMetrics(namespace?)` - Get metrics for pods
- `getClusterMetrics()` - Get cluster-wide aggregated metrics
- `query(promql)` - Execute arbitrary PromQL queries

### Incident Service (`incident.service.ts`)

Detects, classifies, and manages incidents based on metrics.

**Severity Levels:**
- `low` - Minor issues, auto-healing recommended
- `medium` - Moderate issues, auto-healing attempted
- `high` - Significant issues, escalation required
- `critical` - Severe issues, immediate escalation

**Incident Categories:**
- `pod-crash` - Pod in CrashLoopBackOff or Failed state
- `high-cpu` - CPU usage exceeds thresholds
- `high-memory` - Memory usage exceeds thresholds
- `oom-killed` - Pod killed due to OOM
- `node-pressure` - Node experiencing resource pressure
- `node-not-ready` - Node in NotReady state
- `persistent-restarts` - Pod with high restart count

**Auto-Healing Logic:**
1. Low/Medium severity + Pod issues → Attempt auto-healing
2. Match incident to healing rules
3. Execute healing action (restart, scale, etc.)
4. On failure → Escalate to high severity

### Healing Service (`healing.service.ts`)

Manages healing rules and executes remediation actions.

**Action Types:**
- `restart-pod` - Delete pod to trigger restart
- `scale-deployment` - Scale deployment replicas
- `cordon-node` - Mark node as unschedulable
- `drain-node` - Drain workloads from node
- `notify` - Send notification
- `custom-script` - Execute custom remediation

### Simulator Service (`simulator.service.ts`)

Provides chaos engineering capabilities for testing.

**Scenario Types:**
- `pod-failure` - Kill random pods
- `node-failure` - Cordon/drain nodes
- `cpu-stress` - Inject CPU load
- `memory-stress` - Inject memory pressure
- `latency-injection` - Add network latency
- `packet-loss` - Simulate packet loss
- `disk-stress` - Fill disk space
- `network-partition` - Isolate services

## API Endpoints

### Metrics API (`/api/v1/metrics`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/nodes` | GET | Get node metrics |
| `/pods` | GET | Get pod metrics |
| `/cluster` | GET | Get cluster metrics |
| `/query` | GET | Execute PromQL query |
| `/query_range` | GET | Execute PromQL range query |
| `/status` | GET | Check Prometheus connection |

### Incidents API (`/api/v1/incidents`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | List all incidents |
| `/stats` | GET | Get incident statistics |
| `/alerts` | GET | List all alerts |
| `/:id` | GET | Get incident details |
| `/:id/acknowledge` | POST | Acknowledge incident |
| `/:id/resolve` | POST | Resolve incident |
| `/alerts/:id/acknowledge` | POST | Acknowledge alert |

### Simulator API (`/api/v1/simulator`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/scenarios` | GET | List all scenarios |
| `/scenarios/:id` | GET | Get scenario details |
| `/scenarios` | POST | Create custom scenario |
| `/scenarios/:id` | DELETE | Delete scenario |
| `/scenarios/:id/start` | POST | Start simulation |
| `/runs` | GET | List simulation runs |
| `/runs/active` | GET | List active simulations |
| `/runs/:id` | GET | Get run details |
| `/runs/:id/stop` | POST | Stop simulation |
| `/runs/:id/cancel` | POST | Cancel simulation |
| `/stats` | GET | Get simulation statistics |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `KUBECONFIG_PATH` | Path to kubeconfig | `~/.kube/config` |
| `PROMETHEUS_URL` | Prometheus server URL | `http://localhost:9090` |
| `PROMETHEUS_SCRAPE_INTERVAL` | Metrics refresh interval (ms) | `15000` |
| `JWT_SECRET` | JWT signing secret | - |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |

## Deployment

### Local Development

1. Start Minikube cluster:
   ```bash
   # Windows
   .\scripts\setup-minikube.ps1
   
   # Linux/Mac
   ./scripts/setup-minikube.sh
   ```

2. Run backend locally:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Update PROMETHEUS_URL with minikube IP
   npm run dev
   ```

### Kubernetes Deployment

1. Build Docker image:
   ```bash
   docker build -t octrix-backend:latest ./backend
   ```

2. Load into Minikube:
   ```bash
   minikube image load octrix-backend:latest
   ```

3. Deploy:
   ```bash
   kubectl apply -f k8s/octrix/backend-deployment.yaml
   ```

## Real-time Events

The backend uses Socket.IO for real-time updates:

**Events:**
- `cluster:update` - Cluster state changes
- `alert:new` - New alert created
- `healing:event` - Healing action executed

**Subscriptions:**
- `subscribe:cluster` - Subscribe to cluster updates
- `unsubscribe:cluster` - Unsubscribe from cluster updates
