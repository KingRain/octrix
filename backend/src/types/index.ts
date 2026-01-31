export interface Cluster {
  id: string;
  name: string;
  status: ClusterStatus;
  version: string;
  nodeCount: number;
  podCount: number;
  serviceCount: number;
  cpuUsage: number;
  memoryUsage: number;
  createdAt: string;
  region: string;
  provider: CloudProvider;
}

export type ClusterStatus = "healthy" | "warning" | "critical" | "unknown";
export type CloudProvider = "aws" | "gcp" | "azure" | "on-premise";

export interface Node {
  id: string;
  name: string;
  status: NodeStatus;
  role: NodeRole;
  cpuCapacity: number;
  cpuUsage: number;
  memoryCapacity: number;
  memoryUsage: number;
  podCount: number;
  conditions: NodeCondition[];
  labels: Record<string, string>;
  taints: Taint[];
  createdAt: string;
  ip: string;
}

export type NodeStatus = "ready" | "not-ready" | "unknown";
export type NodeRole = "control-plane" | "worker";

export interface NodeCondition {
  type: string;
  status: "True" | "False" | "Unknown";
  reason: string;
  message: string;
  lastTransitionTime: string;
}

export interface Taint {
  key: string;
  value: string;
  effect: "NoSchedule" | "PreferNoSchedule" | "NoExecute";
}

export interface Pod {
  id: string;
  name: string;
  namespace: string;
  status: PodStatus;
  phase: PodPhase;
  nodeName: string;
  containers: Container[];
  restarts: number;
  cpuUsage: number;
  memoryUsage: number;
  createdAt: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  ownerReferences: OwnerReference[];
  ip: string;
  volumes: PodVolume[];
}

export interface PodVolume {
  name: string;
  persistentVolumeClaim?: {
    claimName: string;
  };
}

export type PodStatus = "running" | "pending" | "succeeded" | "failed" | "unknown";
export type PodPhase = "Pending" | "Running" | "Succeeded" | "Failed" | "Unknown";

export interface Container {
  name: string;
  image: string;
  status: ContainerStatus;
  ready: boolean;
  restartCount: number;
  cpuUsage: number;
  memoryUsage: number;
  ports: ContainerPort[];
}

export type ContainerStatus = "running" | "waiting" | "terminated";

export interface ContainerPort {
  name: string;
  containerPort: number;
  protocol: "TCP" | "UDP";
}

export interface OwnerReference {
  kind: string;
  name: string;
  uid: string;
}

export interface Service {
  id: string;
  name: string;
  namespace: string;
  type: ServiceType;
  clusterIP: string;
  externalIP?: string;
  ports: ServicePort[];
  selector: Record<string, string>;
  endpoints: Endpoint[];
  createdAt: string;
}

export type ServiceType = "ClusterIP" | "NodePort" | "LoadBalancer" | "ExternalName";

export interface ServicePort {
  name: string;
  port: number;
  targetPort: number;
  nodePort?: number;
  protocol: "TCP" | "UDP";
}

export interface Endpoint {
  ip: string;
  port: number;
  nodeName: string;
  ready: boolean;
}

export interface HealingRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: HealingTrigger;
  action: HealingAction;
  cooldownSeconds: number;
  lastTriggered?: string;
  triggerCount: number;
  createdAt: string;
}

export interface HealingTrigger {
  type: TriggerType;
  conditions: TriggerCondition[];
  operator: "AND" | "OR";
}

export type TriggerType = "pod-crash" | "high-cpu" | "high-memory" | "oom-killed" | "node-pressure" | "custom";

export interface TriggerCondition {
  metric: string;
  operator: ">" | "<" | ">=" | "<=" | "==" | "!=";
  value: number;
  duration: string;
}

export interface HealingAction {
  type: ActionType;
  parameters: Record<string, unknown>;
}

export type ActionType = "restart-pod" | "scale-deployment" | "cordon-node" | "drain-node" | "custom-script" | "notify";

export interface HealingEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  timestamp: string;
  status: "success" | "failed" | "in-progress" | "skipped";
  targetResource: string;
  targetNamespace: string;
  action: ActionType;
  details: string;
  duration: number;
  trigger?: string;
  outcome?: string;
  actionLabel?: string;
  fromReplicas?: number;
  toReplicas?: number;
}

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  type: ScenarioType;
  parameters: Record<string, unknown>;
  duration: number;
  createdAt: string;
}

export type ScenarioType =
  | "pod-failure"
  | "node-failure"
  | "network-partition"
  | "cpu-stress"
  | "memory-stress"
  | "disk-stress"
  | "latency-injection"
  | "packet-loss"
  | "signal-overload";

export interface SimulationRun {
  id: string;
  scenarioId: string;
  scenarioName: string;
  status: SimulationStatus;
  startTime: string;
  endTime?: string;
  affectedResources: string[];
  metrics: SimulationMetric[];
}

export type SimulationStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface SimulationMetric {
  name: string;
  before: number;
  during: number;
  after: number;
  unit: string;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  resource: string;
  namespace: string;
  timestamp: string;
  acknowledged: boolean;
  resolvedAt?: string;
}

export type AlertSeverity = "critical" | "warning" | "info";

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export type UserRole = "admin" | "operator" | "viewer";

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface Namespace {
  id: string;
  name: string;
  status: "Active" | "Terminating";
  labels: Record<string, string>;
  createdAt: string;
  podCount: number;
  serviceCount: number;
}

export interface ServiceGroup {
  name: string;
  namespace: string;
  pods: PodInfo[];
  totalCpu: number;
  totalMemory: number;
  healthyCount: number;
  healingCount: number;
  failedCount: number;
}

export interface PodInfo {
  id: string;
  name: string;
  nodeName: string;
  status: "healthy" | "healing" | "failed" | "pending" | "unknown";
  cpu: number;
  memory: number;
  restarts: number;
  pvcHealth?: "healthy" | "warning" | "critical" | "none";
  pvcs?: PVCInfo[];
  timeToOomSeconds?: number;
  memoryGrowthRateBytesPerSecond?: number;
  cpuLimit?: number;
  memoryLimit?: number;
}

export interface PVCInfo {
  name: string;
  status: string;
  capacityBytes: number;
  usedBytes: number;
  usagePercent: number;
  health: "healthy" | "warning" | "critical";
}

export interface ClusterOverview {
  connected: boolean;
  services: ServiceGroup[];
  totalPods: number;
  healthyPods: number;
  healingPods: number;
  failedPods: number;
  totalCpu: number;
  totalMemory: number;
  usedCpu: number;
  usedMemory: number;
}
