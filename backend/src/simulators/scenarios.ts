import { v4 as uuidv4 } from "uuid";
import type { IncidentCategory, IncidentSeverity } from "../incidents/types.js";

export type SimulationScenarioType =
  | "oom-killed"
  | "high-cpu"
  | "crash-loop"
  | "pod-throttling"
  | "underutilization"
  | "node-eviction"
  | "image-pull-delay"
  | "buggy-deployment"
  | "configmap-error"
  | "db-failure"
  | "unknown-crash"
  | "multi-service-failure"
  | "pod-running-app-broken"
  | "readiness-lies"
  | "config-drift"
  | "network-blackhole"
  | "custom-oom";

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  type: SimulationScenarioType;
  incidentCategory: IncidentCategory;
  severity: IncidentSeverity;
  autoHealable: boolean;
  productionBehavior: string;
  localSimulation: string;
  parameters: Record<string, unknown>;
  duration: number;
  createdAt: string;
}

export interface SimulationRun {
  id: string;
  scenarioId: string;
  scenarioName: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startTime: string;
  endTime?: string;
  targetNamespace: string;
  targetResource?: string;
  affectedResources: string[];
  incidentId?: string;
  metrics: SimulationMetric[];
}

export interface SimulationMetric {
  name: string;
  before: number;
  during: number;
  after: number;
  unit: string;
}

export const DEFAULT_SCENARIOS: Omit<SimulationScenario, "id" | "createdAt">[] = [
  {
    name: "OOMKilled Pod",
    description: "Simulate a pod being killed due to memory exhaustion",
    type: "oom-killed",
    incidentCategory: "oom-killed",
    severity: "low",
    autoHealable: true,
    productionBehavior: "Pod crashes due to memory exhaustion",
    localSimulation: "Set memory limit to 64Mi and allocate more",
    parameters: { memoryLimitMi: 64, allocateMi: 128 },
    duration: 30,
  },
  {
    name: "High CPU Usage",
    description: "Simulate high CPU load causing latency spikes",
    type: "high-cpu",
    incidentCategory: "high-cpu",
    severity: "low",
    autoHealable: true,
    productionBehavior: "Latency spikes, slow response times",
    localSimulation: "Run CPU stress test in container",
    parameters: { cpuLoadPercent: 90, workers: 4 },
    duration: 60,
  },
  {
    name: "CrashLoop (Transient)",
    description: "Simulate repeated pod restarts",
    type: "crash-loop",
    incidentCategory: "crash-loop",
    severity: "low",
    autoHealable: true,
    productionBehavior: "Repeated pod restarts (CrashLoopBackOff)",
    localSimulation: "Exit container with non-zero code",
    parameters: { exitCode: 1, restartCount: 5 },
    duration: 120,
  },
  {
    name: "Pod Throttling",
    description: "Simulate CPU throttling due to low limits",
    type: "pod-throttling",
    incidentCategory: "pod-throttling",
    severity: "low",
    autoHealable: true,
    productionBehavior: "CPU capped, degraded performance",
    localSimulation: "Set very low CPU limit (50m)",
    parameters: { cpuLimitMillicores: 50 },
    duration: 60,
  },
  {
    name: "Underutilization",
    description: "Simulate resource waste with low utilization",
    type: "underutilization",
    incidentCategory: "underutilization",
    severity: "low",
    autoHealable: true,
    productionBehavior: "Resource waste, cost inefficiency",
    localSimulation: "Reduce traffic to near zero",
    parameters: { utilizationPercent: 5 },
    duration: 300,
  },
  {
    name: "Node Eviction",
    description: "Simulate pod eviction due to node issues",
    type: "node-eviction",
    incidentCategory: "node-eviction",
    severity: "low",
    autoHealable: true,
    productionBehavior: "Pod rescheduled to different node",
    localSimulation: "Cordon and drain node",
    parameters: { drainTimeout: 60 },
    duration: 120,
  },
  {
    name: "Image Pull Delay",
    description: "Simulate slow or failed image pulls",
    type: "image-pull-delay",
    incidentCategory: "image-pull-delay",
    severity: "low",
    autoHealable: true,
    productionBehavior: "Pod stuck in Pending state",
    localSimulation: "Use slow/unavailable registry",
    parameters: { delaySeconds: 30, failPull: false },
    duration: 60,
  },
  {
    name: "Buggy Deployment",
    description: "Simulate a deployment with broken code causing 5xx errors",
    type: "buggy-deployment",
    incidentCategory: "buggy-deployment",
    severity: "high",
    autoHealable: false,
    productionBehavior: "5xx errors, service degradation",
    localSimulation: "Deploy image with broken code",
    parameters: { errorRate: 50, errorCode: 500 },
    duration: 180,
  },
  {
    name: "ConfigMap Error",
    description: "Simulate missing or invalid configuration",
    type: "configmap-error",
    incidentCategory: "configmap-error",
    severity: "high",
    autoHealable: false,
    productionBehavior: "App crash due to missing config",
    localSimulation: "Remove required environment variable",
    parameters: { missingEnvVar: "DATABASE_URL" },
    duration: 60,
  },
  {
    name: "Database Failure",
    description: "Simulate database connection failure",
    type: "db-failure",
    incidentCategory: "db-failure",
    severity: "critical",
    autoHealable: false,
    productionBehavior: "Service completely down",
    localSimulation: "Point to wrong DB endpoint",
    parameters: { wrongEndpoint: "invalid-db:5432" },
    duration: 120,
  },
  {
    name: "Unknown Crash",
    description: "Simulate non-standard failure pattern",
    type: "unknown-crash",
    incidentCategory: "unknown-crash",
    severity: "high",
    autoHealable: false,
    productionBehavior: "Non-standard failure pattern",
    localSimulation: "Inject random crash signal (SIGKILL)",
    parameters: { signal: "SIGKILL", random: true },
    duration: 60,
  },
  {
    name: "Multi-Service Failure",
    description: "Simulate cascading outage across services",
    type: "multi-service-failure",
    incidentCategory: "multi-service-failure",
    severity: "critical",
    autoHealable: false,
    productionBehavior: "Cascading outage across services",
    localSimulation: "Kill shared dependency service",
    parameters: { targetServices: ["redis", "postgres"], cascadeDelay: 10 },
    duration: 300,
  },
  // Silent Failures
  {
    name: "Broken App (Latency)",
    description: "App responds slowly/incorrectly while Pod status remains Running",
    type: "pod-running-app-broken",
    incidentCategory: "pod-running-app-broken" as IncidentCategory,
    severity: "high",
    autoHealable: true,
    productionBehavior: "High latency, no crashes, simple K8s probes pass",
    localSimulation: "Inject 5s sleep in API response",
    parameters: { latencyMs: 5000, cpuThrottle: true },
    duration: 120,
  },
  {
    name: "Readiness Lies",
    description: "Readiness probe returns 200 OK while critical dependency is down",
    type: "readiness-lies",
    incidentCategory: "readiness-lies" as IncidentCategory,
    severity: "high",
    autoHealable: false,
    productionBehavior: "Traffic routed to broken pods, 500 errors",
    localSimulation: "Mock /health 200 OK but DB connection fail",
    parameters: { dependency: "database", probeStatus: 200 },
    duration: 120,
  },
  {
    name: "Config Drift",
    description: "Application running with old configuration after ConfigMap update",
    type: "config-drift",
    incidentCategory: "config-drift" as IncidentCategory,
    severity: "medium",
    autoHealable: true,
    productionBehavior: "Behavior mismatch, zero Kubernetes signals",
    localSimulation: "Update ConfigMap without rolling restart",
    parameters: { configKey: "FEATURE_FLAG", oldValue: "false", newValue: "true" },
    duration: 300,
  },
  {
    name: "Network Blackhole",
    description: "Pod cannot reach external dependencies but remains 'Healthy'",
    type: "network-blackhole",
    incidentCategory: "network-blackhole" as IncidentCategory,
    severity: "critical",
    autoHealable: false,
    productionBehavior: "DNS/Egress fails, Pod still Running",
    localSimulation: "Block egress traffic with NetworkPolicy",
    parameters: { packetLoss: 100, dnsFail: true },
    duration: 120,
  }
];

class ScenarioManager {
  private scenarios: Map<string, SimulationScenario> = new Map();

  constructor() {
    this.loadDefaultScenarios();
  }

  private loadDefaultScenarios() {
    DEFAULT_SCENARIOS.forEach((scenario) => {
      const fullScenario: SimulationScenario = {
        ...scenario,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
      };
      this.scenarios.set(fullScenario.id, fullScenario);
    });
  }

  getScenarios(): SimulationScenario[] {
    return Array.from(this.scenarios.values());
  }

  getScenario(id: string): SimulationScenario | undefined {
    return this.scenarios.get(id);
  }

  getScenarioByType(type: SimulationScenarioType): SimulationScenario | undefined {
    return Array.from(this.scenarios.values()).find((s) => s.type === type);
  }

  createScenario(scenario: Omit<SimulationScenario, "id" | "createdAt">): SimulationScenario {
    const fullScenario: SimulationScenario = {
      ...scenario,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };
    this.scenarios.set(fullScenario.id, fullScenario);
    return fullScenario;
  }

  deleteScenario(id: string): boolean {
    return this.scenarios.delete(id);
  }
}

export const scenarioManager = new ScenarioManager();
