import { createChildLogger } from "../utils/logger.js";
import { prometheusCollector } from "./prometheus.collector.js";

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
}

export async function collectNodeMetrics(): Promise<NodeMetrics[]> {
  const connected = await prometheusCollector.checkConnection();

  if (!connected) {
    logger.debug("Using mock node metrics");
    return getMockNodeMetrics();
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

    return Array.from(nodeMap.values())
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
  } catch (error) {
    logger.error({ error }, "Failed to collect node metrics from Prometheus");
    return getMockNodeMetrics();
  }
}

function getMockNodeMetrics(): NodeMetrics[] {
  const nodes = [
    { name: "octrix-control-plane", cores: 4, memGB: 8, uptime: 1555200 },
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
