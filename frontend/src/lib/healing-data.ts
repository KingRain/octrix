export type HealingActionType = "restart" | "scale-up" | "scale-down" | "resource-patch" | "rollback" | "eviction";
export type TriggerSignal = "cpu" | "memory" | "restart-count" | "latency" | "error-rate" | "oom";
export type ActionOutcome = "success" | "partial" | "failed";

export interface HealingAction {
  id: string;
  timestamp: string;
  actionType: HealingActionType;
  targetResource: string;
  namespace: string;
  triggerSignal: TriggerSignal;
  triggerValue: string;
  threshold: string;
  outcome: ActionOutcome;
  duration: number;
  details: string;
  beforeState: ResourceState;
  afterState: ResourceState;
}

export interface ResourceState {
  cpu?: number;
  memory?: number;
  replicas?: number;
  restarts?: number;
  status: string;
}

export interface MTTRMetric {
  date: string;
  mttr: number;
  incidents: number;
  autoHealed: number;
}

const actionTypeLabels: Record<HealingActionType, string> = {
  restart: "Pod Restart",
  "scale-up": "Scale Up",
  "scale-down": "Scale Down",
  "resource-patch": "Resource Patch",
  rollback: "Rollback",
  eviction: "Pod Eviction",
};

const triggerSignalLabels: Record<TriggerSignal, string> = {
  cpu: "CPU Usage",
  memory: "Memory Usage",
  "restart-count": "Restart Count",
  latency: "Response Latency",
  "error-rate": "Error Rate",
  oom: "OOM Killed",
};

export { actionTypeLabels, triggerSignalLabels };

export const mockHealingActions: HealingAction[] = [
  {
    id: "heal-001",
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    actionType: "restart",
    targetResource: "payment-service-7d8f9c6b5-x2k4m",
    namespace: "production",
    triggerSignal: "oom",
    triggerValue: "OOM Killed",
    threshold: "Memory limit exceeded",
    outcome: "success",
    duration: 45000,
    details: "Pod restarted after OOM kill. Memory limit increased from 512Mi to 768Mi.",
    beforeState: { memory: 512, restarts: 4, status: "OOMKilled" },
    afterState: { memory: 768, restarts: 5, status: "Running" },
  },
  {
    id: "heal-002",
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    actionType: "scale-up",
    targetResource: "api-gateway",
    namespace: "production",
    triggerSignal: "cpu",
    triggerValue: "92%",
    threshold: ">85% for 2m",
    outcome: "success",
    duration: 120000,
    details: "Scaled deployment from 3 to 6 replicas due to sustained high CPU usage.",
    beforeState: { cpu: 92, replicas: 3, status: "HighLoad" },
    afterState: { cpu: 45, replicas: 6, status: "Healthy" },
  },
  {
    id: "heal-003",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    actionType: "resource-patch",
    targetResource: "order-processor-8e9f0a1b2-d4e5f",
    namespace: "production",
    triggerSignal: "memory",
    triggerValue: "95%",
    threshold: ">90% for 5m",
    outcome: "success",
    duration: 30000,
    details: "Increased memory request from 256Mi to 512Mi and limit from 512Mi to 1Gi.",
    beforeState: { memory: 95, status: "MemoryPressure" },
    afterState: { memory: 48, status: "Running" },
  },
  {
    id: "heal-004",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    actionType: "restart",
    targetResource: "user-service-5c7d8e9f1-a3b2c",
    namespace: "production",
    triggerSignal: "restart-count",
    triggerValue: "5 restarts",
    threshold: ">3 in 10m",
    outcome: "partial",
    duration: 60000,
    details: "Pod restarted but issue persisted. Escalated for manual review.",
    beforeState: { restarts: 5, status: "CrashLoopBackOff" },
    afterState: { restarts: 6, status: "CrashLoopBackOff" },
  },
  {
    id: "heal-005",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    actionType: "scale-down",
    targetResource: "notification-service",
    namespace: "production",
    triggerSignal: "cpu",
    triggerValue: "12%",
    threshold: "<20% for 15m",
    outcome: "success",
    duration: 90000,
    details: "Scaled deployment from 8 to 4 replicas during low traffic period.",
    beforeState: { cpu: 12, replicas: 8, status: "Overprovisioned" },
    afterState: { cpu: 24, replicas: 4, status: "Optimized" },
  },
  {
    id: "heal-006",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    actionType: "rollback",
    targetResource: "checkout-service",
    namespace: "production",
    triggerSignal: "error-rate",
    triggerValue: "15%",
    threshold: ">5% for 3m",
    outcome: "success",
    duration: 180000,
    details: "Rolled back to previous version (v2.3.1) after detecting high error rate in v2.4.0.",
    beforeState: { status: "Degraded" },
    afterState: { status: "Healthy" },
  },
  {
    id: "heal-007",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    actionType: "eviction",
    targetResource: "batch-processor-0",
    namespace: "production",
    triggerSignal: "memory",
    triggerValue: "Node at 98%",
    threshold: "Node memory >95%",
    outcome: "success",
    duration: 45000,
    details: "Low-priority pod evicted to relieve node memory pressure. Rescheduled to different node.",
    beforeState: { status: "Running", memory: 2048 },
    afterState: { status: "Running", memory: 2048 },
  },
  {
    id: "heal-008",
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    actionType: "restart",
    targetResource: "cache-service-redis-0",
    namespace: "production",
    triggerSignal: "latency",
    triggerValue: "850ms",
    threshold: ">500ms p99",
    outcome: "success",
    duration: 30000,
    details: "Redis pod restarted after detecting high latency. Connection pool reset.",
    beforeState: { status: "Degraded" },
    afterState: { status: "Healthy" },
  },
];

export const mockMTTRData: MTTRMetric[] = [
  { date: "Mon", mttr: 12.5, incidents: 8, autoHealed: 6 },
  { date: "Tue", mttr: 10.2, incidents: 12, autoHealed: 10 },
  { date: "Wed", mttr: 8.7, incidents: 6, autoHealed: 5 },
  { date: "Thu", mttr: 7.3, incidents: 9, autoHealed: 8 },
  { date: "Fri", mttr: 6.1, incidents: 11, autoHealed: 10 },
  { date: "Sat", mttr: 5.8, incidents: 4, autoHealed: 4 },
  { date: "Sun", mttr: 5.2, incidents: 3, autoHealed: 3 },
];

export function getHealingStats() {
  const total = mockHealingActions.length;
  const successful = mockHealingActions.filter((a) => a.outcome === "success").length;
  const partial = mockHealingActions.filter((a) => a.outcome === "partial").length;
  const failed = mockHealingActions.filter((a) => a.outcome === "failed").length;
  const avgDuration = mockHealingActions.reduce((sum, a) => sum + a.duration, 0) / total;

  const currentMTTR = mockMTTRData[mockMTTRData.length - 1].mttr;
  const previousMTTR = mockMTTRData[0].mttr;
  const mttrReduction = Math.round(((previousMTTR - currentMTTR) / previousMTTR) * 100);

  return {
    total,
    successful,
    partial,
    failed,
    successRate: Math.round((successful / total) * 100),
    avgDuration,
    currentMTTR,
    mttrReduction,
    byAction: {
      restart: mockHealingActions.filter((a) => a.actionType === "restart").length,
      "scale-up": mockHealingActions.filter((a) => a.actionType === "scale-up").length,
      "scale-down": mockHealingActions.filter((a) => a.actionType === "scale-down").length,
      "resource-patch": mockHealingActions.filter((a) => a.actionType === "resource-patch").length,
      rollback: mockHealingActions.filter((a) => a.actionType === "rollback").length,
      eviction: mockHealingActions.filter((a) => a.actionType === "eviction").length,
    },
    byTrigger: {
      cpu: mockHealingActions.filter((a) => a.triggerSignal === "cpu").length,
      memory: mockHealingActions.filter((a) => a.triggerSignal === "memory").length,
      "restart-count": mockHealingActions.filter((a) => a.triggerSignal === "restart-count").length,
      latency: mockHealingActions.filter((a) => a.triggerSignal === "latency").length,
      "error-rate": mockHealingActions.filter((a) => a.triggerSignal === "error-rate").length,
      oom: mockHealingActions.filter((a) => a.triggerSignal === "oom").length,
    },
  };
}
