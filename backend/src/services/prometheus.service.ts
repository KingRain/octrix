import { createChildLogger } from "../utils/logger.js";
import { config } from "../config/index.js";

const logger = createChildLogger("prometheus-service");

export interface PrometheusMetric {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface NodeMetrics {
  nodeName: string;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  memoryUsageBytes: number;
  memoryTotalBytes: number;
  diskUsagePercent: number;
  networkReceiveBytesRate: number;
  networkTransmitBytesRate: number;
  podCount: number;
  conditions: {
    ready: boolean;
    memoryPressure: boolean;
    diskPressure: boolean;
    pidPressure: boolean;
  };
}

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
  containerStatuses: ContainerMetrics[];
  timeToOomSeconds?: number;
  memoryGrowthRateBytesPerSecond?: number;
}

export interface ContainerMetrics {
  containerName: string;
  cpuUsageCores: number;
  memoryUsageBytes: number;
  restartCount: number;
  state: "running" | "waiting" | "terminated";
  ready: boolean;
}

export interface ClusterMetrics {
  totalNodes: number;
  readyNodes: number;
  totalPods: number;
  runningPods: number;
  pendingPods: number;
  failedPods: number;
  totalCpuCores: number;
  usedCpuCores: number;
  totalMemoryBytes: number;
  usedMemoryBytes: number;
  deploymentCount: number;
  serviceCount: number;
}

interface PrometheusQueryResult {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      metric: Record<string, string>;
      value?: [number, string];
      values?: [number, string][];
    }>;
  };
}

export class PrometheusService {
  private baseUrl: string;
  private isConnected: boolean = false;
  private lastCheckTime: number = 0;
  private checkInterval: number = 30000;

  constructor() {
    this.baseUrl = config.prometheus?.url || "http://localhost:9090";
    logger.info({ url: this.baseUrl }, "Prometheus service initialized");
  }

  async checkConnection(): Promise<boolean> {
    const now = Date.now();
    
    if (now - this.lastCheckTime < this.checkInterval && this.lastCheckTime > 0) {
      return this.isConnected;
    }
    
    this.lastCheckTime = now;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${this.baseUrl}/api/v1/status/config`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      this.isConnected = response.ok;
      
      if (this.isConnected) {
        logger.info({ url: this.baseUrl }, "Prometheus connected");
      }
      
      return this.isConnected;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.isConnected = false;
      return false;
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async query(promql: string): Promise<PrometheusQueryResult | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const url = `${this.baseUrl}/api/v1/query?query=${encodeURIComponent(promql)}`;
      const response = await fetch(url, { signal: controller.signal });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Prometheus query failed: ${response.statusText}`);
      }
      
      return (await response.json()) as PrometheusQueryResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (!errorMessage.includes("abort")) {
        logger.error({ error: errorMessage, query: promql }, "Prometheus query error");
      }
      return null;
    }
  }

  async queryRange(
    promql: string,
    start: number,
    end: number,
    step: string
  ): Promise<PrometheusQueryResult | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const url = `${this.baseUrl}/api/v1/query_range?query=${encodeURIComponent(promql)}&start=${start}&end=${end}&step=${step}`;
      const response = await fetch(url, { signal: controller.signal });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Prometheus range query failed: ${response.statusText}`);
      }
      
      return (await response.json()) as PrometheusQueryResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (!errorMessage.includes("abort")) {
        logger.error({ error: errorMessage, query: promql }, "Prometheus range query error");
      }
      return null;
    }
  }

  async getNodeMetrics(): Promise<NodeMetrics[]> {
    const connected = await this.checkConnection();
    
    if (!connected) {
      return [];
    }

    try {
      const [cpuResult, memoryResult, diskResult, podCountResult] = await Promise.all([
        this.query('100 - (avg by (node) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'),
        this.query('(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100'),
        this.query('(1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})) * 100'),
        this.query('count by (node) (kube_pod_info)'),
      ]);

      const nodeMap = new Map<string, Partial<NodeMetrics>>();

      cpuResult?.data?.result?.forEach((r) => {
        const nodeName = r.metric.node || r.metric.instance;
        if (nodeName && r.value) {
          nodeMap.set(nodeName, {
            ...nodeMap.get(nodeName),
            nodeName,
            cpuUsagePercent: parseFloat(r.value[1]),
          });
        }
      });

      memoryResult?.data?.result?.forEach((r) => {
        const nodeName = r.metric.node || r.metric.instance;
        if (nodeName && r.value) {
          nodeMap.set(nodeName, {
            ...nodeMap.get(nodeName),
            nodeName,
            memoryUsagePercent: parseFloat(r.value[1]),
          });
        }
      });

      diskResult?.data?.result?.forEach((r) => {
        const nodeName = r.metric.node || r.metric.instance;
        if (nodeName && r.value) {
          nodeMap.set(nodeName, {
            ...nodeMap.get(nodeName),
            nodeName,
            diskUsagePercent: parseFloat(r.value[1]),
          });
        }
      });

      podCountResult?.data?.result?.forEach((r) => {
        const nodeName = r.metric.node;
        if (nodeName && r.value) {
          nodeMap.set(nodeName, {
            ...nodeMap.get(nodeName),
            nodeName,
            podCount: parseInt(r.value[1], 10),
          });
        }
      });

      return Array.from(nodeMap.values()).map((n) => ({
        nodeName: n.nodeName || "unknown",
        cpuUsagePercent: n.cpuUsagePercent || 0,
        memoryUsagePercent: n.memoryUsagePercent || 0,
        memoryUsageBytes: 0,
        memoryTotalBytes: 0,
        diskUsagePercent: n.diskUsagePercent || 0,
        networkReceiveBytesRate: 0,
        networkTransmitBytesRate: 0,
        podCount: n.podCount || 0,
        conditions: {
          ready: true,
          memoryPressure: (n.memoryUsagePercent || 0) > 90,
          diskPressure: (n.diskUsagePercent || 0) > 90,
          pidPressure: false,
        },
      }));
    } catch (error) {
      logger.error({ error }, "Failed to get node metrics from Prometheus");
      return [];
    }
  }

  async getPodMetrics(namespace?: string): Promise<PodMetrics[]> {
    const connected = await this.checkConnection();
    
    if (!connected) {
      return [];
    }

    try {
      const namespaceFilter = namespace ? `namespace="${namespace}"` : "";
      
      const [cpuResult, memoryResult, restartResult, memoryGrowthResult] = await Promise.all([
        this.query(`sum by (pod, namespace, node) (rate(container_cpu_usage_seconds_total{${namespaceFilter}}[5m]))`),
        this.query(`sum by (pod, namespace, node) (container_memory_usage_bytes{${namespaceFilter}})`),
        this.query(`sum by (pod, namespace) (kube_pod_container_status_restarts_total{${namespaceFilter}})`),
        this.queryRange(`sum by (pod, namespace) (container_memory_usage_bytes{${namespaceFilter}})`, Date.now() - 300000, Date.now(), '60s'),
      ]);

      const podMap = new Map<string, Partial<PodMetrics>>();

      cpuResult?.data?.result?.forEach((r) => {
        const key = `${r.metric.namespace}/${r.metric.pod}`;
        if (r.value) {
          podMap.set(key, {
            ...podMap.get(key),
            podName: r.metric.pod,
            namespace: r.metric.namespace,
            nodeName: r.metric.node,
            cpuUsageCores: parseFloat(r.value[1]),
          });
        }
      });

      memoryResult?.data?.result?.forEach((r) => {
        const key = `${r.metric.namespace}/${r.metric.pod}`;
        if (r.value) {
          podMap.set(key, {
            ...podMap.get(key),
            podName: r.metric.pod,
            namespace: r.metric.namespace,
            memoryUsageBytes: parseFloat(r.value[1]),
          });
        }
      });

      restartResult?.data?.result?.forEach((r) => {
        const key = `${r.metric.namespace}/${r.metric.pod}`;
        if (r.value) {
          podMap.set(key, {
            ...podMap.get(key),
            restartCount: parseInt(r.value[1], 10),
          });
        }
      });

      // Calculate memory growth rate and time to OOM
      memoryGrowthResult?.data?.result?.forEach((r) => {
        const key = `${r.metric.namespace}/${r.metric.pod}`;
        const values = r.values;
        if (values && values.length >= 2) {
          const currentMemory = parseFloat(values[values.length - 1][1]);
          const previousMemory = parseFloat(values[0][1]);
          const timeDiff = (values[values.length - 1][0] - values[0][0]) / 1000; // Convert to seconds
          
          if (timeDiff > 0) {
            const growthRate = (currentMemory - previousMemory) / timeDiff;
            const memoryLimit = 256 * 1024 * 1024; // Default 256MB limit
            const timeToOom = growthRate > 0 ? (memoryLimit - currentMemory) / growthRate : Infinity;
            
            podMap.set(key, {
              ...podMap.get(key),
              memoryGrowthRateBytesPerSecond: growthRate,
              timeToOomSeconds: timeToOom === Infinity ? undefined : Math.max(0, timeToOom),
            });
          }
        }
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
        memoryLimitBytes: 256 * 1024 * 1024,
        restartCount: p.restartCount || 0,
        containerStatuses: [],
        timeToOomSeconds: p.timeToOomSeconds,
        memoryGrowthRateBytesPerSecond: p.memoryGrowthRateBytesPerSecond,
      }));
    } catch (error) {
      logger.error({ error }, "Failed to get pod metrics from Prometheus");
      return [];
    }
  }

  async getClusterMetrics(): Promise<ClusterMetrics> {
    const connected = await this.checkConnection();
    
    if (!connected) {
      return {
        totalNodes: 0,
        readyNodes: 0,
        totalPods: 0,
        runningPods: 0,
        pendingPods: 0,
        failedPods: 0,
        totalCpuCores: 0,
        usedCpuCores: 0,
        totalMemoryBytes: 0,
        usedMemoryBytes: 0,
        deploymentCount: 0,
        serviceCount: 0,
      };
    }

    try {
      const [
        nodeCountResult,
        readyNodesResult,
        podCountResult,
        runningPodsResult,
        pendingPodsResult,
        failedPodsResult,
        cpuTotalResult,
        cpuUsedResult,
        memoryTotalResult,
        memoryUsedResult,
      ] = await Promise.all([
        this.query("count(kube_node_info)"),
        this.query('count(kube_node_status_condition{condition="Ready",status="true"})'),
        this.query("count(kube_pod_info)"),
        this.query('count(kube_pod_status_phase{phase="Running"})'),
        this.query('count(kube_pod_status_phase{phase="Pending"})'),
        this.query('count(kube_pod_status_phase{phase="Failed"})'),
        this.query("sum(kube_node_status_allocatable{resource=\"cpu\"})"),
        this.query("sum(rate(container_cpu_usage_seconds_total[5m]))"),
        this.query("sum(kube_node_status_allocatable{resource=\"memory\"})"),
        this.query("sum(container_memory_usage_bytes)"),
      ]);

      return {
        totalNodes: this.extractValue(nodeCountResult) || 0,
        readyNodes: this.extractValue(readyNodesResult) || 0,
        totalPods: this.extractValue(podCountResult) || 0,
        runningPods: this.extractValue(runningPodsResult) || 0,
        pendingPods: this.extractValue(pendingPodsResult) || 0,
        failedPods: this.extractValue(failedPodsResult) || 0,
        totalCpuCores: this.extractValue(cpuTotalResult) || 0,
        usedCpuCores: this.extractValue(cpuUsedResult) || 0,
        totalMemoryBytes: this.extractValue(memoryTotalResult) || 0,
        usedMemoryBytes: this.extractValue(memoryUsedResult) || 0,
        deploymentCount: 0,
        serviceCount: 0,
      };
    } catch (error) {
      logger.error({ error }, "Failed to get cluster metrics from Prometheus");
      return {
        totalNodes: 0,
        readyNodes: 0,
        totalPods: 0,
        runningPods: 0,
        pendingPods: 0,
        failedPods: 0,
        totalCpuCores: 0,
        usedCpuCores: 0,
        totalMemoryBytes: 0,
        usedMemoryBytes: 0,
        deploymentCount: 0,
        serviceCount: 0,
      };
    }
  }

  private extractValue(result: PrometheusQueryResult | null): number | null {
    if (!result?.data?.result?.[0]?.value?.[1]) {
      return null;
    }
    return parseFloat(result.data.result[0].value[1]);
  }
}

export const prometheusService = new PrometheusService();
