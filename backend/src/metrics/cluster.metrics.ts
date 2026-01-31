import { createChildLogger } from "../utils/logger.js";
import { prometheusCollector } from "./prometheus.collector.js";

const logger = createChildLogger("cluster-metrics");

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
  healthScore: number;
}

export async function collectClusterMetrics(): Promise<ClusterMetrics> {
  const connected = await prometheusCollector.checkConnection();
  
  if (!connected) {
    logger.debug("Using mock cluster metrics");
    return getMockClusterMetrics();
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
      prometheusCollector.query("count(kube_node_info)"),
      prometheusCollector.query('count(kube_node_status_condition{condition="Ready",status="true"})'),
      prometheusCollector.query("count(kube_pod_info)"),
      prometheusCollector.query('count(kube_pod_status_phase{phase="Running"})'),
      prometheusCollector.query('count(kube_pod_status_phase{phase="Pending"})'),
      prometheusCollector.query('count(kube_pod_status_phase{phase="Failed"})'),
      prometheusCollector.query("sum(kube_node_status_allocatable{resource=\"cpu\"})"),
      prometheusCollector.query("sum(rate(container_cpu_usage_seconds_total[5m]))"),
      prometheusCollector.query("sum(kube_node_status_allocatable{resource=\"memory\"})"),
      prometheusCollector.query("sum(container_memory_usage_bytes)"),
    ]);

    const totalNodes = prometheusCollector.extractValue(nodeCountResult) || 0;
    const readyNodes = prometheusCollector.extractValue(readyNodesResult) || 0;
    const totalPods = prometheusCollector.extractValue(podCountResult) || 0;
    const runningPods = prometheusCollector.extractValue(runningPodsResult) || 0;
    const failedPods = prometheusCollector.extractValue(failedPodsResult) || 0;

    const healthScore = calculateHealthScore(totalNodes, readyNodes, totalPods, runningPods, failedPods);

    return {
      totalNodes,
      readyNodes,
      totalPods,
      runningPods,
      pendingPods: prometheusCollector.extractValue(pendingPodsResult) || 0,
      failedPods,
      totalCpuCores: prometheusCollector.extractValue(cpuTotalResult) || 0,
      usedCpuCores: prometheusCollector.extractValue(cpuUsedResult) || 0,
      totalMemoryBytes: prometheusCollector.extractValue(memoryTotalResult) || 0,
      usedMemoryBytes: prometheusCollector.extractValue(memoryUsedResult) || 0,
      deploymentCount: 0,
      serviceCount: 0,
      healthScore,
    };
  } catch (error) {
    logger.error({ error }, "Failed to collect cluster metrics from Prometheus");
    return getMockClusterMetrics();
  }
}

function calculateHealthScore(
  totalNodes: number,
  readyNodes: number,
  totalPods: number,
  runningPods: number,
  failedPods: number
): number {
  if (totalNodes === 0 || totalPods === 0) return 100;
  
  const nodeHealth = (readyNodes / totalNodes) * 100;
  const podHealth = ((runningPods) / totalPods) * 100;
  const failurePenalty = (failedPods / totalPods) * 50;
  
  return Math.max(0, Math.min(100, (nodeHealth * 0.4 + podHealth * 0.6) - failurePenalty));
}

function getMockClusterMetrics(): ClusterMetrics {
  return {
    totalNodes: 3,
    readyNodes: 3,
    totalPods: 65,
    runningPods: 62,
    pendingPods: 2,
    failedPods: 1,
    totalCpuCores: 12,
    usedCpuCores: 4.5,
    totalMemoryBytes: 24 * 1024 * 1024 * 1024,
    usedMemoryBytes: 12 * 1024 * 1024 * 1024,
    deploymentCount: 15,
    serviceCount: 12,
    healthScore: 94,
  };
}
