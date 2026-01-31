import type { Pod } from "@/types";

export type PodHealthStatus = "healthy" | "healing" | "escalated";

export interface ServicePodGroup {
  serviceName: string;
  namespace: string;
  pods: PodWithHealth[];
  totalCpu: number;
  totalMemory: number;
  cpuLimit: number;
  memoryLimit: number;
}

export interface PodWithHealth extends Pod {
  healthStatus: PodHealthStatus;
}

function generatePod(
  id: string,
  name: string,
  serviceName: string,
  namespace: string,
  healthStatus: PodHealthStatus,
  nodeName: string
): PodWithHealth {
  const isHealthy = healthStatus === "healthy";
  const isHealing = healthStatus === "healing";
  const isFailed = healthStatus === "escalated";

  return {
    id,
    name,
    namespace,
    status: isHealthy ? "running" : isHealing ? "running" : "failed",
    phase: isHealthy ? "Running" : isHealing ? "Running" : "Failed",
    nodeName,
    containers: [
      {
        name: serviceName,
        image: `octrix/${serviceName}:latest`,
        status: isHealthy ? "running" : isHealing ? "running" : "terminated",
        ready: isHealthy,
        restartCount: isHealthy ? 0 : isHealing ? 3 : 8,
        cpuUsage: isHealthy ? Math.floor(Math.random() * 200) + 100 : isFailed ? 0 : 50,
        memoryUsage: isHealthy ? Math.floor(Math.random() * 400) + 200 : isFailed ? 0 : 100,
        ports: [{ name: "http", containerPort: 8080, protocol: "TCP" as const }],
      },
    ],
    restarts: isHealthy ? 0 : isHealing ? 3 : 8,
    cpuUsage: isHealthy ? Math.floor(Math.random() * 200) + 100 : isFailed ? 0 : 50,
    memoryUsage: isHealthy ? Math.floor(Math.random() * 400) + 200 : isFailed ? 0 : 100,
    createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    labels: { app: serviceName },
    annotations: {},
    ownerReferences: [{ kind: "ReplicaSet", name: `${serviceName}-rs`, uid: `rs-${id}` }],
    ip: `10.244.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 255)}`,
    healthStatus,
  };
}

export const servicePodsData: ServicePodGroup[] = [
  {
    serviceName: "Streaming Services",
    namespace: "production",
    cpuLimit: 8000,
    memoryLimit: 16384,
    totalCpu: 0,
    totalMemory: 0,
    pods: [
      generatePod("stream-1", "streaming-7d8f9c6b5-a1b2c", "streaming", "production", "healthy", "node-1"),
      generatePod("stream-2", "streaming-7d8f9c6b5-d3e4f", "streaming", "production", "healthy", "node-2"),
      generatePod("stream-3", "streaming-7d8f9c6b5-g5h6i", "streaming", "production", "healthy", "node-3"),
      generatePod("stream-4", "streaming-7d8f9c6b5-j7k8l", "streaming", "production", "healthy", "node-1"),
      generatePod("stream-5", "streaming-7d8f9c6b5-m9n0o", "streaming", "production", "healthy", "node-2"),
      generatePod("stream-6", "streaming-7d8f9c6b5-p1q2r", "streaming", "production", "healthy", "node-3"),
      generatePod("stream-7", "streaming-7d8f9c6b5-s3t4u", "streaming", "production", "healthy", "node-1"),
      generatePod("stream-8", "streaming-7d8f9c6b5-v5w6x", "streaming", "production", "healthy", "node-2"),
      generatePod("stream-9", "streaming-7d8f9c6b5-y7z8a", "streaming", "production", "healthy", "node-3"),
      generatePod("stream-10", "streaming-7d8f9c6b5-b9c0d", "streaming", "production", "healthy", "node-1"),
    ],
  },
  {
    serviceName: "Authentication",
    namespace: "production",
    cpuLimit: 4000,
    memoryLimit: 8192,
    totalCpu: 0,
    totalMemory: 0,
    pods: [
      generatePod("auth-1", "auth-service-7d8f9c6b5-x2k4m", "auth-service", "production", "healthy", "node-1"),
      generatePod("auth-2", "auth-service-7d8f9c6b5-y3l5n", "auth-service", "production", "healthy", "node-2"),
      generatePod("auth-3", "auth-service-7d8f9c6b5-z4m6o", "auth-service", "production", "healthy", "node-1"),
      generatePod("auth-4", "auth-service-7d8f9c6b5-a5n7p", "auth-service", "production", "healthy", "node-2"),
      generatePod("auth-5", "auth-service-7d8f9c6b5-b6o8q", "auth-service", "production", "healthy", "node-3"),
      generatePod("auth-6", "auth-service-7d8f9c6b5-c7p9r", "auth-service", "production", "healthy", "node-1"),
    ],
  },
  {
    serviceName: "Notifications",
    namespace: "production",
    cpuLimit: 3000,
    memoryLimit: 6144,
    totalCpu: 0,
    totalMemory: 0,
    pods: [
      generatePod("notif-1", "notifications-2a3b4c5d6-a1b2c", "notifications", "production", "healthy", "node-1"),
      generatePod("notif-2", "notifications-2a3b4c5d6-d3e4f", "notifications", "production", "healthy", "node-2"),
      generatePod("notif-3", "notifications-2a3b4c5d6-g5h6i", "notifications", "production", "healing", "node-3"),
      generatePod("notif-4", "notifications-2a3b4c5d6-j7k8l", "notifications", "production", "healthy", "node-1"),
      generatePod("notif-5", "notifications-2a3b4c5d6-m9n0o", "notifications", "production", "healthy", "node-2"),
      generatePod("notif-6", "notifications-2a3b4c5d6-p1q2r", "notifications", "production", "healthy", "node-3"),
      generatePod("notif-7", "notifications-2a3b4c5d6-s3t4u", "notifications", "production", "healthy", "node-1"),
      generatePod("notif-8", "notifications-2a3b4c5d6-v5w6x", "notifications", "production", "healthy", "node-2"),
      generatePod("notif-9", "notifications-2a3b4c5d6-y7z8a", "notifications", "production", "healthy", "node-3"),
    ],
  },
  {
    serviceName: "Payments",
    namespace: "production",
    cpuLimit: 6000,
    memoryLimit: 12288,
    totalCpu: 0,
    totalMemory: 0,
    pods: [
      generatePod("pay-1", "payments-5c7d8e9f1-a1b2c", "payments", "production", "healthy", "node-1"),
      generatePod("pay-2", "payments-5c7d8e9f1-d3e4f", "payments", "production", "healthy", "node-2"),
      generatePod("pay-3", "payments-5c7d8e9f1-g5h6i", "payments", "production", "healthy", "node-3"),
      generatePod("pay-4", "payments-5c7d8e9f1-j7k8l", "payments", "production", "healing", "node-1"),
      generatePod("pay-5", "payments-5c7d8e9f1-m9n0o", "payments", "production", "healthy", "node-2"),
      generatePod("pay-6", "payments-5c7d8e9f1-p1q2r", "payments", "production", "healthy", "node-3"),
      generatePod("pay-7", "payments-5c7d8e9f1-s3t4u", "payments", "production", "healthy", "node-1"),
      generatePod("pay-8", "payments-5c7d8e9f1-v5w6x", "payments", "production", "healthy", "node-2"),
    ],
  },
  {
    serviceName: "Network Security",
    namespace: "progress",
    cpuLimit: 4000,
    memoryLimit: 8192,
    totalCpu: 0,
    totalMemory: 0,
    pods: [
      generatePod("netsec-1", "network-sec-8e9f0a1b2-a1b2c", "network-security", "production", "healthy", "node-1"),
      generatePod("netsec-2", "network-sec-8e9f0a1b2-d3e4f", "network-security", "production", "healthy", "node-2"),
      generatePod("netsec-3", "network-sec-8e9f0a1b2-g5h6i", "network-security", "production", "healthy", "node-3"),
      generatePod("netsec-4", "network-sec-8e9f0a1b2-j7k8l", "network-security", "production", "healthy", "node-1"),
      generatePod("netsec-5", "network-sec-8e9f0a1b2-m9n0o", "network-security", "production", "healthy", "node-2"),
      generatePod("netsec-6", "network-sec-8e9f0a1b2-p1q2r", "network-security", "production", "healthy", "node-3"),
      generatePod("netsec-7", "network-sec-8e9f0a1b2-s3t4u", "network-security", "production", "healthy", "node-1"),
    ],
  },
  {
    serviceName: "Databases",
    namespace: "production",
    cpuLimit: 8000,
    memoryLimit: 32768,
    totalCpu: 0,
    totalMemory: 0,
    pods: [
      generatePod("db-1", "postgres-primary-0", "postgres", "production", "healthy", "node-1"),
      generatePod("db-2", "postgres-replica-0", "postgres", "production", "healthy", "node-2"),
      generatePod("db-3", "postgres-replica-1", "postgres", "production", "healthy", "node-3"),
      generatePod("db-4", "redis-cache-0", "redis", "production", "healthy", "node-1"),
      generatePod("db-5", "redis-cache-1", "redis", "production", "healthy", "node-2"),
      generatePod("db-6", "mongodb-0", "mongodb", "production", "escalated", "node-3"),
    ],
  },
];

servicePodsData.forEach((service) => {
  service.totalCpu = service.pods.reduce((sum, pod) => sum + pod.cpuUsage, 0);
  service.totalMemory = service.pods.reduce((sum, pod) => sum + pod.memoryUsage, 0);
});

export function getClusterHealthSummary() {
  const allPods = servicePodsData.flatMap((s) => s.pods);
  return {
    healthy: allPods.filter((p) => p.healthStatus === "healthy").length,
    healing: allPods.filter((p) => p.healthStatus === "healing").length,
    escalated: allPods.filter((p) => p.healthStatus === "escalated").length,
    total: allPods.length,
  };
}

export function getTotalClusterMetrics() {
  return {
    cpuUsage: servicePodsData.reduce((sum, s) => sum + s.totalCpu, 0),
    cpuLimit: servicePodsData.reduce((sum, s) => sum + s.cpuLimit, 0),
    memoryUsage: servicePodsData.reduce((sum, s) => sum + s.totalMemory, 0),
    memoryLimit: servicePodsData.reduce((sum, s) => sum + s.memoryLimit, 0),
  };
}
