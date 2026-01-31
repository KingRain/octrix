import { createChildLogger } from "../utils/logger.js";
import { prometheusCollector } from "./prometheus.collector.js";

const logger = createChildLogger("pod-metrics");

export interface PodMetrics {
  podName: string;
  namespace: string;
  nodeName: string;
  cpuUsageCores: number;
  cpuRequestCores: number;
  cpuLimitCores: number;
  memoryUsageBytes: number;
  memoryRequestBytes: number;
  memoryLimitBytes: number;
  restartCount: number;
  oomKilled: boolean;
  throttled: boolean;
  phase: string;
  containerStatuses: ContainerMetrics[];
}

export interface ContainerMetrics {
  containerName: string;
  cpuUsageCores: number;
  memoryUsageBytes: number;
  restartCount: number;
  state: "running" | "waiting" | "terminated";
  ready: boolean;
  oomKilled: boolean;
}

export async function collectPodMetrics(namespace?: string): Promise<PodMetrics[]> {
  const connected = await prometheusCollector.checkConnection();
  
  if (!connected) {
    logger.debug("Using mock pod metrics");
    return getMockPodMetrics(namespace);
  }

  try {
    const namespaceFilter = namespace ? `namespace="${namespace}"` : "";
    
    const [cpuResult, memoryResult, restartResult, oomResult, throttledResult] = await Promise.all([
      prometheusCollector.query(`sum by (pod, namespace, node) (rate(container_cpu_usage_seconds_total{${namespaceFilter}}[5m]))`),
      prometheusCollector.query(`sum by (pod, namespace, node) (container_memory_usage_bytes{${namespaceFilter}})`),
      prometheusCollector.query(`sum by (pod, namespace) (kube_pod_container_status_restarts_total{${namespaceFilter}})`),
      prometheusCollector.query(`sum by (pod, namespace) (kube_pod_container_status_last_terminated_reason{reason="OOMKilled",${namespaceFilter}})`),
      prometheusCollector.query(`sum by (pod, namespace) (rate(container_cpu_cfs_throttled_periods_total{${namespaceFilter}}[5m]))`),
    ]);

    const podMap = new Map<string, Partial<PodMetrics>>();

    prometheusCollector.extractValues(cpuResult).forEach((r) => {
      const key = `${r.labels.namespace}/${r.labels.pod}`;
      podMap.set(key, {
        ...podMap.get(key),
        podName: r.labels.pod,
        namespace: r.labels.namespace,
        nodeName: r.labels.node,
        cpuUsageCores: r.value,
      });
    });

    prometheusCollector.extractValues(memoryResult).forEach((r) => {
      const key = `${r.labels.namespace}/${r.labels.pod}`;
      podMap.set(key, {
        ...podMap.get(key),
        podName: r.labels.pod,
        namespace: r.labels.namespace,
        memoryUsageBytes: r.value,
      });
    });

    prometheusCollector.extractValues(restartResult).forEach((r) => {
      const key = `${r.labels.namespace}/${r.labels.pod}`;
      podMap.set(key, {
        ...podMap.get(key),
        restartCount: r.value,
      });
    });

    prometheusCollector.extractValues(oomResult).forEach((r) => {
      const key = `${r.labels.namespace}/${r.labels.pod}`;
      podMap.set(key, {
        ...podMap.get(key),
        oomKilled: r.value > 0,
      });
    });

    prometheusCollector.extractValues(throttledResult).forEach((r) => {
      const key = `${r.labels.namespace}/${r.labels.pod}`;
      podMap.set(key, {
        ...podMap.get(key),
        throttled: r.value > 0.1,
      });
    });

    return Array.from(podMap.values()).map((p) => ({
      podName: p.podName || "unknown",
      namespace: p.namespace || "default",
      nodeName: p.nodeName || "unknown",
      cpuUsageCores: p.cpuUsageCores || 0,
      cpuRequestCores: 0,
      cpuLimitCores: 0,
      memoryUsageBytes: p.memoryUsageBytes || 0,
      memoryRequestBytes: 0,
      memoryLimitBytes: 0,
      restartCount: p.restartCount || 0,
      oomKilled: p.oomKilled || false,
      throttled: p.throttled || false,
      phase: "Running",
      containerStatuses: [],
    }));
  } catch (error) {
    logger.error({ error }, "Failed to collect pod metrics from Prometheus");
    return getMockPodMetrics(namespace);
  }
}

function getMockPodMetrics(namespace?: string): PodMetrics[] {
  return [];
}
