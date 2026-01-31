export interface PodInfo {
  id: string;
  name: string;
  status: "healthy" | "healing" | "failed" | "pending" | "unknown";
  cpu: number;
  memory: number;
  restarts: number;
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

export interface NodeMetrics {
  nodeName: string;
  cpuUsagePercent: number;
  cpuUsedCores: number;
  cpuTotalCores: number;
  memoryUsagePercent: number;
  memoryUsageBytes: number;
  memoryTotalBytes: number;
  diskUsagePercent: number;
  podCount: number;
  uptimeSeconds: number;
}
