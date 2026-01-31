export type ScenarioType = 
  | "oom-killed"
  | "high-cpu"
  | "crash-loop"
  | "cpu-throttling"
  | "underutilized"
  | "buggy-deployment"
  | "config-error"
  | "db-connection"
  | "unknown-crash"
  | "multi-service";

export type SeverityLevel = "critical" | "high" | "medium" | "low";
export type ResponseType = "auto-heal" | "escalate" | "alert-only";

export interface SimulatorScenario {
  id: string;
  name: string;
  type: ScenarioType;
  description: string;
  severity: SeverityLevel;
  expectedResponse: ResponseType;
  autoHealAction: string;
  parameters: ScenarioParameter[];
  estimatedDuration: string;
  safeForLocal: boolean;
}

export interface ScenarioParameter {
  name: string;
  label: string;
  type: "select" | "number" | "text";
  options?: string[];
  default: string | number;
  min?: number;
  max?: number;
  unit?: string;
}

export interface SimulationRun {
  id: string;
  scenarioId: string;
  scenarioName: string;
  status: "pending" | "running" | "completed" | "failed";
  startTime: string;
  endTime?: string;
  events: SimulationEvent[];
  result?: SimulationResult;
}

export interface SimulationEvent {
  timestamp: string;
  type: "start" | "inject" | "detect" | "respond" | "resolve" | "escalate";
  message: string;
}

export interface SimulationResult {
  detected: boolean;
  detectionTime: number;
  responded: boolean;
  responseTime: number;
  resolved: boolean;
  resolutionTime: number;
  responseType: ResponseType;
}

export const simulatorScenarios: SimulatorScenario[] = [
  {
    id: "sim-oom-killed",
    name: "OOMKilled Pod",
    type: "oom-killed",
    description: "Trigger a pod with artificially low memory limit causing OOMKilled events. Tests memory remediation.",
    severity: "low",
    expectedResponse: "auto-heal",
    autoHealAction: "Patch memory limits and restart pod",
    estimatedDuration: "30-60s",
    safeForLocal: true,
    parameters: [
      { name: "target", label: "Target Service", type: "select", options: ["video-streaming", "transcoding", "recommendations"], default: "video-streaming" },
      { name: "memoryLimit", label: "Memory Limit", type: "number", default: 64, min: 32, max: 256, unit: "Mi" },
    ],
  },
  {
    id: "sim-high-cpu",
    name: "High CPU Usage",
    type: "high-cpu",
    description: "Inject CPU stress to simulate traffic spikes. Tests horizontal scaling capabilities.",
    severity: "low",
    expectedResponse: "auto-heal",
    autoHealAction: "Scale deployment horizontally",
    estimatedDuration: "60-120s",
    safeForLocal: true,
    parameters: [
      { name: "target", label: "Target Service", type: "select", options: ["video-streaming", "cdn-edge", "transcoding"], default: "video-streaming" },
      { name: "cpuPercent", label: "CPU Target", type: "number", default: 85, min: 50, max: 100, unit: "%" },
      { name: "duration", label: "Duration", type: "number", default: 120, min: 30, max: 300, unit: "s" },
    ],
  },
  {
    id: "sim-crash-loop",
    name: "CrashLoopBackOff",
    type: "crash-loop",
    description: "Force container to exit repeatedly. Tests restart backoff and recovery within retry window.",
    severity: "low",
    expectedResponse: "auto-heal",
    autoHealAction: "Restart pod with exponential backoff",
    estimatedDuration: "60-90s",
    safeForLocal: true,
    parameters: [
      { name: "target", label: "Target Service", type: "select", options: ["auth-service", "payments", "analytics"], default: "auth-service" },
      { name: "crashReason", label: "Crash Reason", type: "select", options: ["exit-code-1", "sigkill", "dependency-timeout"], default: "exit-code-1" },
    ],
  },
  {
    id: "sim-cpu-throttling",
    name: "Pod CPU Throttling",
    type: "cpu-throttling",
    description: "Set extremely low CPU limits while workload demand remains normal. Tests CPU limit adjustment.",
    severity: "low",
    expectedResponse: "auto-heal",
    autoHealAction: "Increase CPU limits conservatively",
    estimatedDuration: "45-75s",
    safeForLocal: true,
    parameters: [
      { name: "target", label: "Target Service", type: "select", options: ["transcoding", "recommendations", "content-metadata"], default: "transcoding" },
      { name: "cpuLimit", label: "CPU Limit", type: "number", default: 50, min: 10, max: 200, unit: "m" },
    ],
  },
  {
    id: "sim-underutilized",
    name: "Underutilized Resources",
    type: "underutilized",
    description: "Reduce traffic while replicas remain high. Tests scale-down and cost optimization.",
    severity: "low",
    expectedResponse: "auto-heal",
    autoHealAction: "Scale down replicas gradually",
    estimatedDuration: "90-150s",
    safeForLocal: true,
    parameters: [
      { name: "target", label: "Target Service", type: "select", options: ["cdn-edge", "video-streaming", "auth-service"], default: "cdn-edge" },
      { name: "utilizationTarget", label: "Target Utilization", type: "number", default: 15, min: 5, max: 30, unit: "%" },
    ],
  },
  {
    id: "sim-buggy-deployment",
    name: "Buggy Deployment",
    type: "buggy-deployment",
    description: "Deploy an image that returns 5xx errors or crashes immediately. Tests error detection and escalation.",
    severity: "high",
    expectedResponse: "escalate",
    autoHealAction: "Halt automation, capture diagnostics, escalate",
    estimatedDuration: "30-60s",
    safeForLocal: true,
    parameters: [
      { name: "target", label: "Target Service", type: "select", options: ["video-streaming", "payments", "recommendations"], default: "video-streaming" },
      { name: "errorRate", label: "Error Rate", type: "number", default: 50, min: 20, max: 100, unit: "%" },
      { name: "errorType", label: "Error Type", type: "select", options: ["500-errors", "immediate-crash", "timeout"], default: "500-errors" },
    ],
  },
  {
    id: "sim-config-error",
    name: "ConfigMap / Env Error",
    type: "config-error",
    description: "Remove or corrupt required environment variables causing immediate startup failure.",
    severity: "high",
    expectedResponse: "escalate",
    autoHealAction: "Refuse retry, log config failure, escalate",
    estimatedDuration: "15-30s",
    safeForLocal: true,
    parameters: [
      { name: "target", label: "Target Service", type: "select", options: ["auth-service", "payments", "content-metadata"], default: "auth-service" },
      { name: "errorType", label: "Error Type", type: "select", options: ["missing-env", "invalid-secret", "malformed-config"], default: "missing-env" },
    ],
  },
  {
    id: "sim-db-connection",
    name: "Database Connection Failure",
    type: "db-connection",
    description: "Point service to invalid database endpoint. Tests readiness probe failure handling.",
    severity: "high",
    expectedResponse: "escalate",
    autoHealAction: "Freeze automation, capture diagnostics, escalate",
    estimatedDuration: "30-60s",
    safeForLocal: true,
    parameters: [
      { name: "target", label: "Target Service", type: "select", options: ["payments", "auth-service", "analytics"], default: "payments" },
      { name: "failureType", label: "Failure Type", type: "select", options: ["connection-refused", "timeout", "auth-failed"], default: "connection-refused" },
    ],
  },
  {
    id: "sim-unknown-crash",
    name: "Unknown Crash Pattern",
    type: "unknown-crash",
    description: "Inject random or non-deterministic crashes that don't match known signatures.",
    severity: "high",
    expectedResponse: "escalate",
    autoHealAction: "Mark as unknown, attach diagnostics, escalate",
    estimatedDuration: "45-90s",
    safeForLocal: true,
    parameters: [
      { name: "target", label: "Target Service", type: "select", options: ["transcoding", "recommendations", "video-streaming"], default: "transcoding" },
      { name: "crashPattern", label: "Crash Pattern", type: "select", options: ["random-interval", "memory-corruption", "race-condition"], default: "random-interval" },
    ],
  },
  {
    id: "sim-multi-service",
    name: "Multi-Service Failure",
    type: "multi-service",
    description: "Take down a shared dependency causing multiple services to degrade simultaneously.",
    severity: "high",
    expectedResponse: "escalate",
    autoHealAction: "Raise single critical incident, suppress noise",
    estimatedDuration: "60-120s",
    safeForLocal: true,
    parameters: [
      { name: "dependency", label: "Shared Dependency", type: "select", options: ["redis-cache", "message-queue", "service-mesh"], default: "redis-cache" },
      { name: "affectedServices", label: "Affected Services", type: "number", default: 4, min: 2, max: 8 },
    ],
  },
];

export const mockSimulationRuns: SimulationRun[] = [];

export function getSimulatorStats() {
  const totalRuns = mockSimulationRuns.length;
  const completedRuns = mockSimulationRuns.filter((r) => r.status === "completed").length;
  const successfulDetections = mockSimulationRuns.filter((r) => r.result?.detected).length;
  const autoHealed = mockSimulationRuns.filter((r) => r.result?.responseType === "auto-heal" && r.result?.resolved).length;

  const avgDetectionTime = mockSimulationRuns
    .filter((r) => r.result?.detected)
    .reduce((sum, r) => sum + (r.result?.detectionTime || 0), 0) / (successfulDetections || 1);

  return {
    totalRuns,
    completedRuns,
    successfulDetections,
    autoHealed,
    avgDetectionTime,
    detectionRate: Math.round((successfulDetections / totalRuns) * 100),
    autoHealRate: Math.round((autoHealed / totalRuns) * 100),
  };
}
