# Octrix

A production-grade web application for monitoring, auto-healing, and simulating Kubernetes cluster behavior.

## Overview

Octrix is a comprehensive Kubernetes observability and operations platform that provides:

- **Real-time Cluster Monitoring** - Monitor nodes, pods, services, and deployments with live metrics
- **Auto-Healing Engine** - Configure automatic remediation rules for common cluster issues
- **Chaos Engineering Simulation** - Test cluster resilience with controlled failure scenarios
- **Service Topology Visualization** - Interactive graph view of service relationships and pod distribution
- **Alert Management** - Centralized alerting with severity levels and acknowledgment workflows

## Tech Stack

### Frontend
- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query
- **Visualization**: React Flow (topology), Recharts (charts via shadcn)
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Kubernetes Client**: @kubernetes/client-node
- **Metrics**: Prometheus integration
- **Real-time**: Socket.IO
- **Validation**: Zod
- **Logging**: Pino

### Infrastructure
- **Local Cluster**: Minikube
- **Cluster Interaction**: kubectl
- **Metrics Collection**: Prometheus
- **Cluster Metrics**: kube-state-metrics
- **Node Metrics**: node-exporter

## Project Structure

```
octrix/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utilities and mock data
│   │   ├── stores/          # Zustand state stores
│   │   └── types/           # TypeScript type definitions
│   └── package.json
│
├── backend/                  # Express.js backend API
│   ├── src/
│   │   ├── config/          # Configuration management
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic services
│   │   │   ├── kubernetes.service.ts   # K8s cluster interaction
│   │   │   ├── prometheus.service.ts   # Metrics collection
│   │   │   ├── incident.service.ts     # Incident detection & classification
│   │   │   ├── healing.service.ts      # Auto-healing logic
│   │   │   └── simulator.service.ts    # Failure simulation
│   │   ├── types/           # TypeScript type definitions
│   │   ├── utils/           # Utility functions
│   │   └── server.ts        # Application entry point
│   ├── Dockerfile           # Container build
│   └── package.json
│
├── k8s/                      # Kubernetes manifests
│   ├── namespace.yaml       # Namespace definitions
│   ├── prometheus/          # Prometheus stack
│   │   ├── prometheus-config.yaml
│   │   ├── prometheus-deployment.yaml
│   │   ├── kube-state-metrics.yaml
│   │   └── node-exporter.yaml
│   ├── octrix/              # Octrix deployments
│   │   ├── backend-deployment.yaml
│   │   └── frontend-deployment.yaml
│   └── sample-apps/         # Demo applications
│       └── sample-deployment.yaml
│
├── scripts/                  # Setup scripts
│   ├── setup-minikube.sh    # Linux/Mac setup
│   └── setup-minikube.ps1   # Windows setup
│
├── docs/                     # Documentation
│   └── BACKEND.md           # Backend architecture docs
│
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Docker Desktop
- Minikube (for local Kubernetes cluster)
- kubectl (Kubernetes CLI)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Kubernetes Cluster Setup (Minikube)

```bash
# Windows PowerShell
.\scripts\setup-minikube.ps1

# Linux/Mac
./scripts/setup-minikube.sh
```

This will:
- Start a Minikube cluster with recommended settings
- Deploy Prometheus, kube-state-metrics, and node-exporter
- Deploy sample applications for testing

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Update PROMETHEUS_URL with your Minikube IP (run: minikube ip)
npm run dev
```

The API will be available at `http://localhost:3001`

### Deploy to Kubernetes

```bash
# Build and load backend image
docker build -t octrix-backend:latest ./backend
minikube image load octrix-backend:latest

# Deploy
kubectl apply -f k8s/octrix/backend-deployment.yaml
```

## Features

### Dashboard
- Cluster health overview with key metrics
- CPU and memory usage charts
- Recent alerts and healing activity
- Node resource distribution

### Cluster View
- Detailed cluster information
- Namespace management
- Node status and resource allocation

### Pods Management
- List all pods across namespaces
- View pod details and container status
- Restart or delete pods

### Services
- Service discovery and endpoints
- Port mappings and selectors
- Load balancer status

### Topology View
- Interactive service mesh visualization
- Deployment to pod relationships
- Service to pod connections

### Auto-Healing
- Create and manage healing rules
- Trigger conditions (CPU, memory, crashes)
- Action types (restart, scale, cordon)
- Event history and success rates

### Simulation (Chaos Engineering)
- Pod failure scenarios
- Node drain simulation
- CPU/Memory stress tests
- Network latency injection

## API Endpoints

### Cluster
- `GET /api/v1/cluster/nodes` - List all nodes
- `GET /api/v1/cluster/pods` - List all pods
- `GET /api/v1/cluster/services` - List all services
- `GET /api/v1/cluster/namespaces` - List all namespaces
- `POST /api/v1/cluster/nodes/:name/cordon` - Cordon a node
- `DELETE /api/v1/cluster/pods/:namespace/:name` - Delete a pod

### Metrics (Prometheus)
- `GET /api/v1/metrics/nodes` - Get node metrics from Prometheus
- `GET /api/v1/metrics/pods` - Get pod metrics from Prometheus
- `GET /api/v1/metrics/cluster` - Get cluster-wide metrics
- `GET /api/v1/metrics/query` - Execute PromQL query
- `GET /api/v1/metrics/status` - Check Prometheus connection

### Incidents
- `GET /api/v1/incidents` - List all incidents
- `GET /api/v1/incidents/stats` - Get incident statistics
- `GET /api/v1/incidents/alerts` - List all alerts
- `GET /api/v1/incidents/:id` - Get incident details
- `POST /api/v1/incidents/:id/acknowledge` - Acknowledge incident
- `POST /api/v1/incidents/:id/resolve` - Resolve incident

### Healing
- `GET /api/v1/healing/rules` - List healing rules
- `POST /api/v1/healing/rules` - Create a rule
- `PUT /api/v1/healing/rules/:id` - Update a rule
- `DELETE /api/v1/healing/rules/:id` - Delete a rule
- `POST /api/v1/healing/rules/:id/toggle` - Toggle rule status
- `GET /api/v1/healing/events` - List healing events

### Simulator (Chaos Engineering)
- `GET /api/v1/simulator/scenarios` - List simulation scenarios
- `POST /api/v1/simulator/scenarios/:id/start` - Start a simulation
- `GET /api/v1/simulator/runs` - List simulation runs
- `GET /api/v1/simulator/runs/active` - List active simulations
- `POST /api/v1/simulator/runs/:id/stop` - Stop a simulation
- `POST /api/v1/simulator/runs/:id/cancel` - Cancel a simulation

## Configuration

### Environment Variables (Backend)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `KUBECONFIG_PATH` | Path to kubeconfig | `~/.kube/config` |
| `PROMETHEUS_URL` | Prometheus server URL | `http://localhost:9090` |
| `PROMETHEUS_SCRAPE_INTERVAL` | Metrics refresh interval (ms) | `15000` |
| `REDIS_HOST` | Redis host | `localhost` |
| `JWT_SECRET` | JWT signing secret | - |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |

## Extensibility

The project is designed for extensibility:

- **Policy Engines**: Add custom policy evaluation in `backend/src/services/`
- **ML Components**: Integrate anomaly detection in the healing service
- **Observability**: Add Prometheus/Grafana integration via new routes
- **Custom Actions**: Extend `ActionType` in types and implement in healing service

## Screenshots

The application features a dark theme with a professional observability-tool aesthetic, using a consistent color palette optimized for monitoring dashboards.

## License

MIT

