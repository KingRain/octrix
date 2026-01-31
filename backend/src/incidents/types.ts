export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "acknowledged" | "healing" | "escalated" | "resolved";

export type IncidentCategory =
  | "oom-killed"
  | "high-cpu"
  | "high-memory"
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
  | "node-not-ready"
  | "node-pressure";

/**
 * SLO Burn Driver indicates the primary cause of SLO budget consumption:
 * - traffic-surge: Load increase is the primary cause (RPS spike, scale-out pressure)
 * - degradation: Quality regression is the primary cause (bugs, dependency failures, config issues)
 * - mixed: Multiple contributing factors or unclear primary cause
 */
export type SLOBurnDriver = "traffic-surge" | "degradation" | "mixed";

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  category: IncidentCategory;
  status: IncidentStatus;
  resource: string;
  resourceType: "pod" | "node" | "deployment" | "service" | "configmap";
  namespace: string;
  detectedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  autoHealable: boolean;
  autoHealingAttempted: boolean;
  autoHealingResult?: "success" | "failed" | "pending";
  escalated: boolean;
  escalatedAt?: string;
  metrics: Record<string, number | string | boolean>;
  relatedAlerts: string[];
  suggestedAction: string;
  productionBehavior: string;
  // Dynamic SLO burn driver classification
  sloBurnDriver?: SLOBurnDriver;
  sloBurnEvidence?: string;
  sloBurnConfidence?: number;
}

export interface IncidentScenario {
  category: IncidentCategory;
  severity: IncidentSeverity;
  autoHealable: boolean;
  productionBehavior: string;
  systemAction: string;
  localSimulation: string;
  detectionCriteria: DetectionCriteria;
}

export interface DetectionCriteria {
  metricName: string;
  operator: ">" | "<" | ">=" | "<=" | "==" | "!=";
  threshold: number | string | boolean;
  duration?: string;
  additionalConditions?: Record<string, unknown>;
}

export const AUTO_HEALABLE_SCENARIOS: IncidentScenario[] = [
  {
    category: "oom-killed",
    severity: "low",
    autoHealable: true,
    productionBehavior: "Pod crashes due to memory exhaustion",
    systemAction: "Patch memory limit & restart pod",
    localSimulation: "Set memory limit to 64Mi",
    detectionCriteria: {
      metricName: "oom_killed",
      operator: "==",
      threshold: true,
    },
  },
  {
    category: "high-cpu",
    severity: "low",
    autoHealable: true,
    productionBehavior: "Latency spikes, slow response times",
    systemAction: "Scale replicas horizontally",
    localSimulation: "Run CPU stress test in container",
    detectionCriteria: {
      metricName: "cpu_usage_percent",
      operator: ">",
      threshold: 80,
      duration: "5m",
    },
  },
  {
    category: "crash-loop",
    severity: "low",
    autoHealable: true,
    productionBehavior: "Repeated pod restarts (CrashLoopBackOff)",
    systemAction: "Restart with exponential backoff",
    localSimulation: "Exit container with non-zero code",
    detectionCriteria: {
      metricName: "restart_count",
      operator: ">=",
      threshold: 3,
      duration: "10m",
    },
  },
  {
    category: "pod-throttling",
    severity: "low",
    autoHealable: true,
    productionBehavior: "CPU capped, degraded performance",
    systemAction: "Increase CPU limit",
    localSimulation: "Set very low CPU limit",
    detectionCriteria: {
      metricName: "throttled",
      operator: "==",
      threshold: true,
    },
  },
  {
    category: "underutilization",
    severity: "low",
    autoHealable: true,
    productionBehavior: "Resource waste, cost inefficiency",
    systemAction: "Scale down replicas",
    localSimulation: "Reduce traffic to near zero",
    detectionCriteria: {
      metricName: "cpu_usage_percent",
      operator: "<",
      threshold: 10,
      duration: "15m",
    },
  },
  {
    category: "node-eviction",
    severity: "low",
    autoHealable: true,
    productionBehavior: "Pod rescheduled to different node",
    systemAction: "Allow Kubernetes to reschedule",
    localSimulation: "Cordon and drain node",
    detectionCriteria: {
      metricName: "evicted",
      operator: "==",
      threshold: true,
    },
  },
  {
    category: "image-pull-delay",
    severity: "low",
    autoHealable: true,
    productionBehavior: "Pod stuck in Pending state",
    systemAction: "Retry image pull with backoff",
    localSimulation: "Use slow/unavailable registry",
    detectionCriteria: {
      metricName: "image_pull_failed",
      operator: "==",
      threshold: true,
    },
  },
];

export const ESCALATED_SCENARIOS: IncidentScenario[] = [
  {
    category: "buggy-deployment",
    severity: "high",
    autoHealable: false,
    productionBehavior: "5xx errors, service degradation",
    systemAction: "Alert developers, freeze deployments",
    localSimulation: "Deploy image with broken code",
    detectionCriteria: {
      metricName: "error_rate_5xx",
      operator: ">",
      threshold: 10,
      duration: "2m",
    },
  },
  {
    category: "configmap-error",
    severity: "high",
    autoHealable: false,
    productionBehavior: "App crash due to missing config",
    systemAction: "Stop automation, alert ops team",
    localSimulation: "Remove required environment variable",
    detectionCriteria: {
      metricName: "config_error",
      operator: "==",
      threshold: true,
    },
  },
  {
    category: "db-failure",
    severity: "critical",
    autoHealable: false,
    productionBehavior: "Service completely down",
    systemAction: "Freeze healing, alert DBA and on-call",
    localSimulation: "Point to wrong DB endpoint",
    detectionCriteria: {
      metricName: "db_connection_failed",
      operator: "==",
      threshold: true,
    },
  },
  {
    category: "unknown-crash",
    severity: "high",
    autoHealable: false,
    productionBehavior: "Non-standard failure pattern",
    systemAction: "Escalate with full diagnostics",
    localSimulation: "Inject random crash signal",
    detectionCriteria: {
      metricName: "unknown_termination",
      operator: "==",
      threshold: true,
    },
  },
  {
    category: "multi-service-failure",
    severity: "critical",
    autoHealable: false,
    productionBehavior: "Cascading outage across services",
    systemAction: "Raise critical incident, page on-call",
    localSimulation: "Kill shared dependency service",
    detectionCriteria: {
      metricName: "failed_services_count",
      operator: ">=",
      threshold: 3,
    },
  },
];

export const ALL_SCENARIOS = [...AUTO_HEALABLE_SCENARIOS, ...ESCALATED_SCENARIOS];
