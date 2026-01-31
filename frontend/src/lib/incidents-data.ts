export type IncidentSeverity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "resolved" | "mitigated" | "escalated" | "investigating";
export type IncidentType = "oom-kill" | "high-cpu" | "crash-loop" | "node-pressure" | "network-issue" | "config-error";

export interface Incident {
  id: string;
  title: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedResource: string;
  namespace: string;
  rootCause: string;
  actionTaken: string;
  resolution: string;
  detectedAt: string;
  resolvedAt?: string;
  duration: number;
  timeline: IncidentTimelineEvent[];
}

export interface IncidentTimelineEvent {
  timestamp: string;
  event: string;
  type: "detection" | "analysis" | "action" | "resolution" | "escalation";
}

const incidentTypes: Record<IncidentType, string> = {
  "oom-kill": "OOM Kill",
  "high-cpu": "High CPU Usage",
  "crash-loop": "Crash Loop",
  "node-pressure": "Node Pressure",
  "network-issue": "Network Issue",
  "config-error": "Configuration Error",
};

export { incidentTypes };

export const mockIncidents: Incident[] = [
  {
    id: "inc-001",
    title: "Payment Service OOM Kill",
    type: "oom-kill",
    severity: "critical",
    status: "resolved",
    affectedResource: "payment-service-7d8f9c6b5-x2k4m",
    namespace: "production",
    rootCause: "Memory leak in payment processing module causing gradual memory exhaustion. Container exceeded 512Mi limit.",
    actionTaken: "Auto-healing triggered pod restart with increased memory limit (768Mi). Memory profiler enabled for diagnostics.",
    resolution: "Pod successfully restarted with new memory limits. Development team notified for permanent fix.",
    detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    duration: 1800000,
    timeline: [
      { timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), event: "Memory usage exceeded 90% threshold", type: "detection" },
      { timestamp: new Date(Date.now() - 1.95 * 60 * 60 * 1000).toISOString(), event: "Root cause analysis: Memory leak pattern detected", type: "analysis" },
      { timestamp: new Date(Date.now() - 1.9 * 60 * 60 * 1000).toISOString(), event: "OOM Kill triggered by kernel", type: "detection" },
      { timestamp: new Date(Date.now() - 1.85 * 60 * 60 * 1000).toISOString(), event: "Auto-healing: Initiating pod restart with adjusted limits", type: "action" },
      { timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(), event: "Pod healthy, service restored", type: "resolution" },
    ],
  },
  {
    id: "inc-002",
    title: "API Gateway High CPU",
    type: "high-cpu",
    severity: "high",
    status: "resolved",
    affectedResource: "api-gateway-5c7d8e9f1-a3b2c",
    namespace: "production",
    rootCause: "Traffic spike from marketing campaign caused CPU saturation. Request queue depth exceeded threshold.",
    actionTaken: "Horizontal pod autoscaler triggered scale-up from 3 to 6 replicas. Traffic load balanced across new pods.",
    resolution: "CPU usage normalized after scale-up. HPA min replicas increased to 4 for future traffic patterns.",
    detectedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
    duration: 1800000,
    timeline: [
      { timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), event: "CPU usage exceeded 85% for 2 minutes", type: "detection" },
      { timestamp: new Date(Date.now() - 3.95 * 60 * 60 * 1000).toISOString(), event: "Traffic analysis: 3x normal request rate detected", type: "analysis" },
      { timestamp: new Date(Date.now() - 3.9 * 60 * 60 * 1000).toISOString(), event: "HPA triggered: Scaling from 3 to 6 replicas", type: "action" },
      { timestamp: new Date(Date.now() - 3.7 * 60 * 60 * 1000).toISOString(), event: "New pods ready, traffic redistributed", type: "action" },
      { timestamp: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(), event: "CPU normalized at 45%, incident resolved", type: "resolution" },
    ],
  },
  {
    id: "inc-003",
    title: "User Service Crash Loop",
    type: "crash-loop",
    severity: "critical",
    status: "escalated",
    affectedResource: "user-service-8e9f0a1b2-d4e5f",
    namespace: "production",
    rootCause: "Database connection pool exhaustion due to connection leak. Pod unable to establish DB connections on startup.",
    actionTaken: "Auto-restart attempted 3 times. Escalated to on-call engineer after backoff limit reached.",
    resolution: "Pending manual intervention. Database team investigating connection pool settings.",
    detectedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    duration: 2700000,
    timeline: [
      { timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), event: "Pod entered CrashLoopBackOff state", type: "detection" },
      { timestamp: new Date(Date.now() - 44 * 60 * 1000).toISOString(), event: "Log analysis: DB connection timeout errors", type: "analysis" },
      { timestamp: new Date(Date.now() - 43 * 60 * 1000).toISOString(), event: "Auto-healing: Restart attempt 1/3", type: "action" },
      { timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(), event: "Auto-healing: Restart attempt 2/3", type: "action" },
      { timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(), event: "Auto-healing: Restart attempt 3/3", type: "action" },
      { timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), event: "Backoff limit reached, escalating to on-call", type: "escalation" },
    ],
  },
  {
    id: "inc-004",
    title: "Worker Node Memory Pressure",
    type: "node-pressure",
    severity: "high",
    status: "mitigated",
    affectedResource: "ip-10-0-1-103.ec2.internal",
    namespace: "cluster",
    rootCause: "Multiple pods scheduled on node exceeded available memory. Node entered MemoryPressure condition.",
    actionTaken: "Low-priority pods evicted. New pods scheduled to other nodes via pod anti-affinity.",
    resolution: "Node memory pressure relieved. Capacity planning review scheduled.",
    detectedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    duration: 3600000,
    timeline: [
      { timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), event: "Node memory usage exceeded 95%", type: "detection" },
      { timestamp: new Date(Date.now() - 5.9 * 60 * 60 * 1000).toISOString(), event: "MemoryPressure condition set on node", type: "detection" },
      { timestamp: new Date(Date.now() - 5.8 * 60 * 60 * 1000).toISOString(), event: "Identifying eviction candidates by priority", type: "analysis" },
      { timestamp: new Date(Date.now() - 5.7 * 60 * 60 * 1000).toISOString(), event: "Evicting 4 low-priority pods", type: "action" },
      { timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), event: "Memory pressure relieved, node stable", type: "resolution" },
    ],
  },
  {
    id: "inc-005",
    title: "Redis Connection Timeout",
    type: "network-issue",
    severity: "medium",
    status: "resolved",
    affectedResource: "redis-cache-0",
    namespace: "production",
    rootCause: "Network policy misconfiguration blocked traffic from application pods to Redis service.",
    actionTaken: "Network policy automatically rolled back to last known good configuration.",
    resolution: "Connectivity restored. Network policy change flagged for review.",
    detectedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 7.8 * 60 * 60 * 1000).toISOString(),
    duration: 720000,
    timeline: [
      { timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), event: "Connection timeout errors to Redis detected", type: "detection" },
      { timestamp: new Date(Date.now() - 7.95 * 60 * 60 * 1000).toISOString(), event: "Network policy change correlated with incident start", type: "analysis" },
      { timestamp: new Date(Date.now() - 7.9 * 60 * 60 * 1000).toISOString(), event: "Rolling back network policy to previous version", type: "action" },
      { timestamp: new Date(Date.now() - 7.8 * 60 * 60 * 1000).toISOString(), event: "Redis connectivity restored", type: "resolution" },
    ],
  },
  {
    id: "inc-006",
    title: "ConfigMap Update Failure",
    type: "config-error",
    severity: "low",
    status: "resolved",
    affectedResource: "notification-service-config",
    namespace: "production",
    rootCause: "Invalid YAML syntax in ConfigMap update caused pod startup failure.",
    actionTaken: "ConfigMap automatically reverted to previous version. Validation webhook enabled.",
    resolution: "Service restored with previous configuration. YAML linting added to CI pipeline.",
    detectedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 11.9 * 60 * 60 * 1000).toISOString(),
    duration: 360000,
    timeline: [
      { timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), event: "Pod failed to start after ConfigMap update", type: "detection" },
      { timestamp: new Date(Date.now() - 11.98 * 60 * 60 * 1000).toISOString(), event: "YAML parse error identified in ConfigMap", type: "analysis" },
      { timestamp: new Date(Date.now() - 11.95 * 60 * 60 * 1000).toISOString(), event: "Reverting ConfigMap to previous version", type: "action" },
      { timestamp: new Date(Date.now() - 11.9 * 60 * 60 * 1000).toISOString(), event: "Pod started successfully with reverted config", type: "resolution" },
    ],
  },
];

export function getIncidentStats() {
  const total = mockIncidents.length;
  const resolved = mockIncidents.filter((i) => i.status === "resolved").length;
  const escalated = mockIncidents.filter((i) => i.status === "escalated").length;
  const avgResolutionTime = mockIncidents
    .filter((i) => i.resolvedAt)
    .reduce((sum, i) => sum + i.duration, 0) / (resolved || 1);

  return {
    total,
    resolved,
    escalated,
    mitigated: mockIncidents.filter((i) => i.status === "mitigated").length,
    investigating: mockIncidents.filter((i) => i.status === "investigating").length,
    avgResolutionTime,
    bySeverity: {
      critical: mockIncidents.filter((i) => i.severity === "critical").length,
      high: mockIncidents.filter((i) => i.severity === "high").length,
      medium: mockIncidents.filter((i) => i.severity === "medium").length,
      low: mockIncidents.filter((i) => i.severity === "low").length,
    },
    byType: {
      "oom-kill": mockIncidents.filter((i) => i.type === "oom-kill").length,
      "high-cpu": mockIncidents.filter((i) => i.type === "high-cpu").length,
      "crash-loop": mockIncidents.filter((i) => i.type === "crash-loop").length,
      "node-pressure": mockIncidents.filter((i) => i.type === "node-pressure").length,
      "network-issue": mockIncidents.filter((i) => i.type === "network-issue").length,
      "config-error": mockIncidents.filter((i) => i.type === "config-error").length,
    },
  };
}
