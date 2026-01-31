import { createChildLogger } from "../utils/logger.js";
import { prometheusCollector } from "./prometheus.collector.js";
import { kubectlTopService } from "../services/kubectl-top.service.js";
import { kubernetesService } from "../services/kubernetes.service.js";
import { customPodSimulator } from "../simulators/custom-pod-simulator.js";

const logger = createChildLogger("node-metrics");

export interface NodeMetrics {
  nodeName: string;
  cpuUsagePercent: number;
  cpuUsedCores: number;
  cpuTotalCores: number;
  memoryUsagePercent: number;
  memoryUsageBytes: number;
  memoryTotalBytes: number;
  diskUsagePercent: number;
  networkReceiveBytesRate: number;
  networkTransmitBytesRate: number;
  podCount: number;
  uptimeSeconds: number;
  conditions: {
    ready: boolean;
    memoryPressure: boolean;
    diskPressure: boolean;
    pidPressure: boolean;
  };
  // New: Pod-level metrics for this node
  podMetrics?: Array<{
    name: string;
    namespace: string;
    cpuMillicores: number;
    memoryBytes: number;
  }>;
}

interface SimulatedPodMetric {
  name: string;
  namespace: string;
  nodeName: string;
  cpuMillicores: number;
  memoryBytes: number;
}

export async function collectNodeMetrics(): Promise<NodeMetrics[]> {
  // First, try to get real metrics from kubectl top
  try {
    const kubectlMetrics = await collectFromKubectlTop();
    if (kubectlMetrics.length > 0) {
      logger.debug({ count: kubectlMetrics.length }, "Using kubectl top metrics");
      return await mergeSimulatedPods(kubectlMetrics);
    }
  } catch (error) {
    logger.warn({ error }, "kubectl top failed, falling back to prometheus");
  }

  const connected = await prometheusCollector.checkConnection();

  if (!connected) {
    logger.debug("Using mock node metrics");
    return await mergeSimulatedPods(getMockNodeMetrics());
  }

  try {
    const [
      cpuPercentResult,
      memoryPercentResult,
      diskResult,
      podCountResult,
      cpuTotalResult,
      memoryTotalResult,
      memoryAvailResult,
      uptimeResult,
    ] = await Promise.all([
      prometheusCollector.query(
        '100 - (avg by (node) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
      ),
      prometheusCollector.query(
        "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
      ),
      prometheusCollector.query(
        '(1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})) * 100',
      ),
      prometheusCollector.query("count by (node) (kube_pod_info)"),
      prometheusCollector.query(
        'count by (node) (node_cpu_seconds_total{mode="idle"})',
      ),
      prometheusCollector.query("sum by (node) (node_memory_MemTotal_bytes)"),
      prometheusCollector.query(
        "sum by (node) (node_memory_MemAvailable_bytes)",
      ),
      prometheusCollector.query(
        "min by (node) (time() - node_boot_time_seconds)",
      ),
    ]);

    const nodeMap = new Map<string, Partial<NodeMetrics>>();

    const processResult = (
      result: any,
      field: keyof NodeMetrics | "memoryAvailableBytes",
    ) => {
      prometheusCollector.extractValues(result).forEach((r) => {
        const nodeName = r.labels.node || r.labels.instance;
        if (nodeName) {
          const current = nodeMap.get(nodeName) || { nodeName };
          (current as any)[field] = r.value;
          nodeMap.set(nodeName, current);
        }
      });
    };

    processResult(cpuPercentResult, "cpuUsagePercent");
    processResult(memoryPercentResult, "memoryUsagePercent");
    processResult(diskResult, "diskUsagePercent");
    processResult(podCountResult, "podCount");
    processResult(cpuTotalResult, "cpuTotalCores");
    processResult(memoryTotalResult, "memoryTotalBytes");
    processResult(memoryAvailResult, "memoryUsageBytes"); // We'll calculate used from this or use it temporarily
    processResult(uptimeResult, "uptimeSeconds");

    const nodes = Array.from(nodeMap.values())
      .filter((n) => n.nodeName && !n.nodeName.includes("192.168.49.2:9100"))
      .map((n) => {
        const totalMem = n.memoryTotalBytes || 16 * 1024 * 1024 * 1024;
        const availMem = (n as any).memoryUsageBytes || 0; // This was Actually available bytes from our query
        const usedMem = totalMem - availMem;
        const memPercent = n.memoryUsagePercent || (usedMem / totalMem) * 100;

        return {
          nodeName: n.nodeName || "unknown",
          cpuUsagePercent: n.cpuUsagePercent || 0,
          cpuUsedCores:
            ((n.cpuUsagePercent || 0) / 100) * (n.cpuTotalCores || 1),
          cpuTotalCores: n.cpuTotalCores || 1,
          memoryUsagePercent: memPercent,
          memoryUsageBytes: usedMem,
          memoryTotalBytes: totalMem,
          diskUsagePercent: n.diskUsagePercent || 0,
          networkReceiveBytesRate: 0,
          networkTransmitBytesRate: 0,
          podCount: n.podCount || 0,
          uptimeSeconds: n.uptimeSeconds || 0,
          conditions: {
            ready: true,
            memoryPressure: memPercent > 90,
            diskPressure: (n.diskUsagePercent || 0) > 90,
            pidPressure: false,
          },
        };
      });
    return await mergeSimulatedPods(nodes);
  } catch (error) {
    logger.error({ error }, "Failed to collect node metrics from Prometheus");
    return await mergeSimulatedPods(getMockNodeMetrics());
  }
}

function getMockNodeMetrics(): NodeMetrics[] {
  const nodes = [
    { name: "octrix-control-plane", cores: 6, memGB: 8, uptime: 1555200 },
    { name: "octrix-worker-01", cores: 8, memGB: 16, uptime: 864000 },
    { name: "octrix-worker-02", cores: 8, memGB: 16, uptime: 432000 }
  ];

  return nodes.map(node => {
    const cpuUsage = 30 + Math.random() * 40;
    const memUsage = 40 + Math.random() * 40;
    const totalMem = node.memGB * 1024 * 1024 * 1024;
    const usedMem = (memUsage / 100) * totalMem;

    return {
      nodeName: node.name,
      cpuUsagePercent: cpuUsage,
      cpuUsedCores: (cpuUsage / 100) * node.cores,
      cpuTotalCores: node.cores,
      memoryUsagePercent: memUsage,
      memoryUsageBytes: usedMem,
      memoryTotalBytes: totalMem,
      diskUsagePercent: 20 + Math.random() * 30,
      networkReceiveBytesRate: 1024 * 1024 * Math.random(),
      networkTransmitBytesRate: 512 * 1024 * Math.random(),
      podCount: 5 + Math.floor(Math.random() * 10),
      uptimeSeconds: node.uptime + Math.floor(Math.random() * 3600),
      conditions: {
        ready: true,
        memoryPressure: memUsage > 90,
        diskPressure: false,
        pidPressure: false
      },
    };
  });
}

function isSimulatedPod(labels: Record<string, string> | undefined): boolean {
  if (!labels) return false;
  return labels.simulated === "true" || labels.env === "simulation";
}

async function getSimulatedPodMetrics(): Promise<SimulatedPodMetric[]> {
  const simulated: SimulatedPodMetric[] = [];
  const seen = new Set<string>();

  try {
    const pods = await kubernetesService.getPods();
    pods.forEach((pod) => {
      if (!isSimulatedPod(pod.labels)) return;
      const key = `${pod.namespace}/${pod.name}`;
      if (seen.has(key)) return;
      seen.add(key);

      simulated.push({
        name: pod.name,
        namespace: pod.namespace,
        nodeName: pod.nodeName || "octrix-sim-node",
        cpuMillicores: Math.max(0, Math.round(pod.cpuUsage || 0)),
        memoryBytes: Math.max(0, pod.memoryUsage || 0),
      });
    });
  } catch (error) {
    logger.warn({ error }, "Failed to load simulated pods from Kubernetes API");
  }

  const customPods = customPodSimulator.getMetrics();
  customPods.forEach((pod) => {
    const key = `${pod.namespace}/${pod.podName}`;
    if (seen.has(key)) return;
    seen.add(key);

    simulated.push({
      name: pod.podName,
      namespace: pod.namespace,
      nodeName: pod.nodeName || "octrix-sim-node",
      cpuMillicores: Math.max(0, Math.round((pod.cpuUsageCores || 0) * 1000)),
      memoryBytes: Math.max(0, pod.memoryUsageBytes || 0),
    });
  });

  return simulated;
}

async function mergeSimulatedPods(nodes: NodeMetrics[]): Promise<NodeMetrics[]> {
  const simulatedPods = await getSimulatedPodMetrics();
  if (simulatedPods.length === 0) {
    return nodes;
  }

  const podsByNode = new Map<string, SimulatedPodMetric[]>();
  simulatedPods.forEach((pod) => {
    const list = podsByNode.get(pod.nodeName) || [];
    list.push(pod);
    podsByNode.set(pod.nodeName, list);
  });

  const nodeMap = new Map<string, NodeMetrics>();
  nodes.forEach((node) => {
    nodeMap.set(node.nodeName, { ...node });
  });

  podsByNode.forEach((pods, nodeName) => {
    const existing = nodeMap.get(nodeName);
    const existingMetrics = existing?.podMetrics ? [...existing.podMetrics] : [];
    const existingKeys = new Set(
      existingMetrics.map((p) => `${p.namespace}/${p.name}`),
    );
    const newMetrics = pods
      .filter((p) => !existingKeys.has(`${p.namespace}/${p.name}`))
      .map((p) => ({
        name: p.name,
        namespace: p.namespace,
        cpuMillicores: p.cpuMillicores,
        memoryBytes: p.memoryBytes,
      }));

    if (existing) {
      existing.podMetrics = [...existingMetrics, ...newMetrics];
      existing.podCount = (existing.podCount || 0) + newMetrics.length;
      nodeMap.set(nodeName, existing);
      return;
    }

    nodeMap.set(nodeName, {
      nodeName,
      cpuUsagePercent: 0,
      cpuUsedCores: 0,
      cpuTotalCores: 0,
      memoryUsagePercent: 0,
      memoryUsageBytes: 0,
      memoryTotalBytes: 0,
      diskUsagePercent: 0,
      networkReceiveBytesRate: 0,
      networkTransmitBytesRate: 0,
      podCount: newMetrics.length,
      uptimeSeconds: 0,
      conditions: {
        ready: true,
        memoryPressure: false,
        diskPressure: false,
        pidPressure: false,
      },
      podMetrics: newMetrics,
    });
  });

  return Array.from(nodeMap.values());
}

/**
 * Collect node metrics directly from kubectl top commands
 * This provides real-time CPU and memory data from the cluster
 */
async function collectFromKubectlTop(): Promise<NodeMetrics[]> {
  const topData = await kubectlTopService.getTopData();

  if (topData.nodes.length === 0) {
    return [];
  }

  // Get pod metrics grouped by node
  const podsByNode = await kubectlTopService.getPodMetricsByNode();

  return topData.nodes.map(node => {
    const cpuMillicores = kubectlTopService.parseCpuToMillicores(node.cpuCores);
    const memoryBytes = kubectlTopService.parseMemoryToBytes(node.memoryBytes);

    // Estimate total resources from percentages
    // If CPU is at 25% and using 250m, then total = 250m / 0.25 = 1000m = 1 core
    const cpuTotalMillicores = node.cpuPercent > 0
      ? Math.round(cpuMillicores / (node.cpuPercent / 100))
      : 4000; // Default 4 cores

    const memoryTotalBytes = node.memoryPercent > 0
      ? Math.round(memoryBytes / (node.memoryPercent / 100))
      : 8 * 1024 * 1024 * 1024; // Default 8GB

    // Get pods for this node
    const nodePods = podsByNode.get(node.name) || [];
    const podMetricsList = nodePods.map(pod => ({
      name: pod.name,
      namespace: pod.namespace,
      cpuMillicores: kubectlTopService.parseCpuToMillicores(pod.cpuCores),
      memoryBytes: kubectlTopService.parseMemoryToBytes(pod.memoryBytes),
    }));

    return {
      nodeName: node.name,
      cpuUsagePercent: node.cpuPercent,
      cpuUsedCores: cpuMillicores / 1000, // Convert millicores to cores
      cpuTotalCores: cpuTotalMillicores / 1000,
      memoryUsagePercent: node.memoryPercent,
      memoryUsageBytes: memoryBytes,
      memoryTotalBytes: memoryTotalBytes,
      diskUsagePercent: 0, // kubectl top doesn't provide disk info
      networkReceiveBytesRate: 0,
      networkTransmitBytesRate: 0,
      podCount: nodePods.length,
      uptimeSeconds: 0, // Would need separate k8s API call
      conditions: {
        ready: true,
        memoryPressure: node.memoryPercent > 90,
        diskPressure: false,
        pidPressure: false,
      },
      podMetrics: podMetricsList,
    };
  });
}
