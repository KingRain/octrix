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
