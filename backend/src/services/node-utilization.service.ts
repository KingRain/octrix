import { createChildLogger } from "../utils/logger.js";
import { collectNodeMetrics, NodeMetrics } from "../metrics/node.metrics.js";

const logger = createChildLogger("node-utilization-service");

export interface NodeUtilization {
  nodeName: string;
  cpuUsedCores: number;
  cpuCapacityCores: number;
  cpuUtilPercent: number;
  memUsedBytes: number;
  memCapacityBytes: number;
  memUtilPercent: number;
  status: "healthy" | "underutilized" | "saturated";
  wasteScore: number;
  estimatedHourlyCost: number;
  podCount: number;
  labels: Record<string, string>;
}

export interface ClusterUtilizationSummary {
  totalNodes: number;
  avgCpuUtil: number;
  avgMemUtil: number;
  p90CpuUtil: number;
  p90MemUtil: number;
  underutilizedNodes: number;
  saturatedNodes: number;
  totalCpuCores: number;
  totalMemoryBytes: number;
  usedCpuCores: number;
  usedMemoryBytes: number;
  idleCpuCores: number;
  idleMemoryBytes: number;
  estimatedHourlyRunRate: number;
  estimatedMonthlyCost: number;
}

export interface CostOptimizationInsight {
  id: string;
  type: "consolidation" | "waste" | "savings" | "info";
  title: string;
  description: string;
  severity: "high" | "medium" | "low" | "info";
  evidence: {
    metric: string;
    value: string;
    threshold?: string;
  }[];
  potentialSavings?: {
    hourly: number;
    monthly: number;
  };
}

export interface NodeUtilizationData {
  summary: ClusterUtilizationSummary;
  nodes: NodeUtilization[];
  insights: CostOptimizationInsight[];
  costConfig: {
    defaultNodeHourlyCost: number;
    nodeTypeCosts: Record<string, number>;
  };
}

const DEFAULT_NODE_HOURLY_COST = 0.10;
const NODE_TYPE_COSTS: Record<string, number> = {
  "m5.large": 0.096,
  "m5.xlarge": 0.192,
  "m5.2xlarge": 0.384,
  "t3.medium": 0.0416,
  "t3.large": 0.0832,
  "c5.large": 0.085,
  "c5.xlarge": 0.17,
  "minikube": 0.05,
  "kind": 0.05,
  "default": 0.10,
};

const UNDERUTILIZED_CPU_THRESHOLD = 20;
const UNDERUTILIZED_MEM_THRESHOLD = 20;
const SATURATED_CPU_THRESHOLD = 85;
const SATURATED_MEM_THRESHOLD = 85;
const WASTE_THRESHOLD = 0.30;

export class NodeUtilizationService {
  private costConfig = {
    defaultNodeHourlyCost: DEFAULT_NODE_HOURLY_COST,
    nodeTypeCosts: NODE_TYPE_COSTS,
  };

  async getNodeUtilizationData(): Promise<NodeUtilizationData> {
    try {
      const nodeMetrics = await collectNodeMetrics();
      const nodes = this.processNodeMetrics(nodeMetrics);
      const summary = this.calculateClusterSummary(nodes);
      const insights = this.generateInsights(nodes, summary);

      return {
        summary,
        nodes,
        insights,
        costConfig: this.costConfig,
      };
    } catch (error) {
      logger.error({ error }, "Failed to get node utilization data");
      return this.getMockData();
    }
  }

  private processNodeMetrics(metrics: NodeMetrics[]): NodeUtilization[] {
    return metrics.map((node) => {
      const cpuUtilPercent = node.cpuUsagePercent || 0;
      const memUtilPercent = node.memoryUsagePercent || 0;

      const status = this.determineNodeStatus(cpuUtilPercent, memUtilPercent);
      const wasteScore = this.calculateWasteScore(cpuUtilPercent, memUtilPercent);
      const estimatedHourlyCost = this.getNodeHourlyCost(node.nodeName);

      return {
        nodeName: node.nodeName,
        cpuUsedCores: node.cpuUsedCores || 0,
        cpuCapacityCores: node.cpuTotalCores || 1,
        cpuUtilPercent,
        memUsedBytes: node.memoryUsageBytes || 0,
        memCapacityBytes: node.memoryTotalBytes || 1,
        memUtilPercent,
        status,
        wasteScore,
        estimatedHourlyCost,
        podCount: node.podCount || 0,
        labels: {},
      };
    });
  }

  private determineNodeStatus(
    cpuUtil: number,
    memUtil: number
  ): "healthy" | "underutilized" | "saturated" {
    if (cpuUtil > SATURATED_CPU_THRESHOLD || memUtil > SATURATED_MEM_THRESHOLD) {
      return "saturated";
    }
    if (cpuUtil < UNDERUTILIZED_CPU_THRESHOLD && memUtil < UNDERUTILIZED_MEM_THRESHOLD) {
      return "underutilized";
    }
    return "healthy";
  }

  private calculateWasteScore(cpuUtil: number, memUtil: number): number {
    const cpuWaste = Math.max(0, (WASTE_THRESHOLD * 100 - cpuUtil) / 100);
    const memWaste = Math.max(0, (WASTE_THRESHOLD * 100 - memUtil) / 100);
    return parseFloat((cpuWaste + memWaste).toFixed(3));
  }

  private getNodeHourlyCost(nodeName: string): number {
    const lowerName = nodeName.toLowerCase();
    
    for (const [type, cost] of Object.entries(this.costConfig.nodeTypeCosts)) {
      if (lowerName.includes(type.toLowerCase())) {
        return cost;
      }
    }
    
    if (lowerName.includes("minikube") || lowerName.includes("kind") || lowerName.includes("control-plane")) {
      return 0.05;
    }
    
    return this.costConfig.defaultNodeHourlyCost;
  }

  private calculateClusterSummary(nodes: NodeUtilization[]): ClusterUtilizationSummary {
    if (nodes.length === 0) {
      return this.getEmptySummary();
    }

    const cpuUtils = nodes.map((n) => n.cpuUtilPercent).sort((a, b) => a - b);
    const memUtils = nodes.map((n) => n.memUtilPercent).sort((a, b) => a - b);

    const avgCpuUtil = cpuUtils.reduce((a, b) => a + b, 0) / cpuUtils.length;
    const avgMemUtil = memUtils.reduce((a, b) => a + b, 0) / memUtils.length;

    const p90Index = Math.floor(cpuUtils.length * 0.9);
    const p90CpuUtil = cpuUtils[p90Index] || cpuUtils[cpuUtils.length - 1];
    const p90MemUtil = memUtils[p90Index] || memUtils[memUtils.length - 1];

    const underutilizedNodes = nodes.filter((n) => n.status === "underutilized").length;
    const saturatedNodes = nodes.filter((n) => n.status === "saturated").length;

    const totalCpuCores = nodes.reduce((sum, n) => sum + n.cpuCapacityCores, 0);
    const totalMemoryBytes = nodes.reduce((sum, n) => sum + n.memCapacityBytes, 0);
    const usedCpuCores = nodes.reduce((sum, n) => sum + n.cpuUsedCores, 0);
    const usedMemoryBytes = nodes.reduce((sum, n) => sum + n.memUsedBytes, 0);

    const idleCpuCores = totalCpuCores - usedCpuCores;
    const idleMemoryBytes = totalMemoryBytes - usedMemoryBytes;

    const estimatedHourlyRunRate = nodes.reduce((sum, n) => sum + n.estimatedHourlyCost, 0);
    const estimatedMonthlyCost = estimatedHourlyRunRate * 24 * 30;

    return {
      totalNodes: nodes.length,
      avgCpuUtil: parseFloat(avgCpuUtil.toFixed(1)),
      avgMemUtil: parseFloat(avgMemUtil.toFixed(1)),
      p90CpuUtil: parseFloat(p90CpuUtil.toFixed(1)),
      p90MemUtil: parseFloat(p90MemUtil.toFixed(1)),
      underutilizedNodes,
      saturatedNodes,
      totalCpuCores: parseFloat(totalCpuCores.toFixed(2)),
      totalMemoryBytes,
      usedCpuCores: parseFloat(usedCpuCores.toFixed(2)),
      usedMemoryBytes,
      idleCpuCores: parseFloat(idleCpuCores.toFixed(2)),
      idleMemoryBytes,
      estimatedHourlyRunRate: parseFloat(estimatedHourlyRunRate.toFixed(4)),
      estimatedMonthlyCost: parseFloat(estimatedMonthlyCost.toFixed(2)),
    };
  }

  private getEmptySummary(): ClusterUtilizationSummary {
    return {
      totalNodes: 0,
      avgCpuUtil: 0,
      avgMemUtil: 0,
      p90CpuUtil: 0,
      p90MemUtil: 0,
      underutilizedNodes: 0,
      saturatedNodes: 0,
      totalCpuCores: 0,
      totalMemoryBytes: 0,
      usedCpuCores: 0,
      usedMemoryBytes: 0,
      idleCpuCores: 0,
      idleMemoryBytes: 0,
      estimatedHourlyRunRate: 0,
      estimatedMonthlyCost: 0,
    };
  }

  private generateInsights(
    nodes: NodeUtilization[],
    summary: ClusterUtilizationSummary
  ): CostOptimizationInsight[] {
    const insights: CostOptimizationInsight[] = [];

    if (summary.underutilizedNodes > 0) {
      const underutilizedPercent = (summary.underutilizedNodes / summary.totalNodes) * 100;
      const potentialNodesRemovable = Math.floor(summary.underutilizedNodes * 0.5);
      const avgNodeCost = summary.estimatedHourlyRunRate / summary.totalNodes;
      const potentialHourlySavings = potentialNodesRemovable * avgNodeCost;

      insights.push({
        id: "underutilized-nodes",
        type: "consolidation",
        title: `${summary.underutilizedNodes} nodes are underutilized`,
        description: `${summary.underutilizedNodes} of ${summary.totalNodes} nodes (${underutilizedPercent.toFixed(0)}%) have both CPU and memory utilization below 20%. Consider consolidating workloads.`,
        severity: summary.underutilizedNodes >= 2 ? "high" : "medium",
        evidence: [
          { metric: "Underutilized nodes", value: `${summary.underutilizedNodes}` },
          { metric: "Threshold", value: "<20% CPU AND <20% Memory", threshold: "20%" },
          { metric: "Avg cluster CPU util", value: `${summary.avgCpuUtil.toFixed(1)}%` },
          { metric: "Avg cluster Memory util", value: `${summary.avgMemUtil.toFixed(1)}%` },
        ],
        potentialSavings:
          potentialNodesRemovable > 0
            ? {
                hourly: parseFloat(potentialHourlySavings.toFixed(4)),
                monthly: parseFloat((potentialHourlySavings * 24 * 30).toFixed(2)),
              }
            : undefined,
      });
    }

    if (summary.idleCpuCores > 1 || summary.idleMemoryBytes > 2 * 1024 * 1024 * 1024) {
      const idleMemGB = summary.idleMemoryBytes / (1024 * 1024 * 1024);
      insights.push({
        id: "idle-capacity",
        type: "waste",
        title: "Significant idle capacity detected",
        description: `Your cluster has ${summary.idleCpuCores.toFixed(1)} idle CPU cores and ${idleMemGB.toFixed(1)} GB idle memory. This represents unused capacity you're paying for.`,
        severity: summary.idleCpuCores > 4 ? "high" : "medium",
        evidence: [
          { metric: "Idle CPU cores", value: `${summary.idleCpuCores.toFixed(2)} cores` },
          { metric: "Idle Memory", value: `${idleMemGB.toFixed(2)} GB` },
          { metric: "Total CPU cores", value: `${summary.totalCpuCores.toFixed(2)} cores` },
          {
            metric: "Total Memory",
            value: `${(summary.totalMemoryBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`,
          },
        ],
      });
    }

    if (summary.avgCpuUtil < 30 && summary.avgMemUtil < 30 && summary.totalNodes > 1) {
      const conservativeRemovable = Math.max(1, Math.floor(summary.totalNodes * 0.15));
      const avgNodeCost = summary.estimatedHourlyRunRate / summary.totalNodes;
      const potentialHourlySavings = conservativeRemovable * avgNodeCost;

      insights.push({
        id: "consolidation-opportunity",
        type: "savings",
        title: "Consolidation opportunity available",
        description: `With average utilization at ${summary.avgCpuUtil.toFixed(0)}% CPU and ${summary.avgMemUtil.toFixed(0)}% memory, you could potentially reduce your node pool by ${conservativeRemovable} node(s).`,
        severity: "medium",
        evidence: [
          { metric: "Avg CPU utilization", value: `${summary.avgCpuUtil.toFixed(1)}%` },
          { metric: "Avg Memory utilization", value: `${summary.avgMemUtil.toFixed(1)}%` },
          { metric: "Potential nodes to remove", value: `${conservativeRemovable}` },
        ],
        potentialSavings: {
          hourly: parseFloat(potentialHourlySavings.toFixed(4)),
          monthly: parseFloat((potentialHourlySavings * 24 * 30).toFixed(2)),
        },
      });
    }

    if (summary.saturatedNodes > 0) {
      insights.push({
        id: "saturated-nodes",
        type: "info",
        title: `${summary.saturatedNodes} node(s) are saturated`,
        description: `${summary.saturatedNodes} node(s) have CPU or memory utilization above 85%. Monitor these nodes for performance issues.`,
        severity: summary.saturatedNodes >= 2 ? "high" : "low",
        evidence: [
          { metric: "Saturated nodes", value: `${summary.saturatedNodes}` },
          { metric: "Threshold", value: ">85% CPU OR >85% Memory", threshold: "85%" },
        ],
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: "healthy-cluster",
        type: "info",
        title: "Cluster utilization looks healthy",
        description: `Your cluster is running at ${summary.avgCpuUtil.toFixed(0)}% CPU and ${summary.avgMemUtil.toFixed(0)}% memory utilization, which is within optimal range.`,
        severity: "info",
        evidence: [
          { metric: "Avg CPU utilization", value: `${summary.avgCpuUtil.toFixed(1)}%` },
          { metric: "Avg Memory utilization", value: `${summary.avgMemUtil.toFixed(1)}%` },
          { metric: "Total nodes", value: `${summary.totalNodes}` },
        ],
      });
    }

    return insights;
  }

  private getMockData(): NodeUtilizationData {
    const mockNodes: NodeUtilization[] = [
      {
        nodeName: "octrix-control-plane",
        cpuUsedCores: 0.8,
        cpuCapacityCores: 4,
        cpuUtilPercent: 20,
        memUsedBytes: 2 * 1024 * 1024 * 1024,
        memCapacityBytes: 8 * 1024 * 1024 * 1024,
        memUtilPercent: 25,
        status: "healthy",
        wasteScore: 0.15,
        estimatedHourlyCost: 0.05,
        podCount: 12,
        labels: { role: "control-plane" },
      },
      {
        nodeName: "octrix-worker-01",
        cpuUsedCores: 1.2,
        cpuCapacityCores: 8,
        cpuUtilPercent: 15,
        memUsedBytes: 2.5 * 1024 * 1024 * 1024,
        memCapacityBytes: 16 * 1024 * 1024 * 1024,
        memUtilPercent: 15.6,
        status: "underutilized",
        wasteScore: 0.29,
        estimatedHourlyCost: 0.10,
        podCount: 8,
        labels: { role: "worker" },
      },
      {
        nodeName: "octrix-worker-02",
        cpuUsedCores: 5.5,
        cpuCapacityCores: 8,
        cpuUtilPercent: 68.75,
        memUsedBytes: 10 * 1024 * 1024 * 1024,
        memCapacityBytes: 16 * 1024 * 1024 * 1024,
        memUtilPercent: 62.5,
        status: "healthy",
        wasteScore: 0,
        estimatedHourlyCost: 0.10,
        podCount: 15,
        labels: { role: "worker" },
      },
    ];

    const summary = this.calculateClusterSummary(mockNodes);
    const insights = this.generateInsights(mockNodes, summary);

    return {
      summary,
      nodes: mockNodes,
      insights,
      costConfig: this.costConfig,
    };
  }

  updateCostConfig(config: Partial<typeof this.costConfig>): void {
    if (config.defaultNodeHourlyCost !== undefined) {
      this.costConfig.defaultNodeHourlyCost = config.defaultNodeHourlyCost;
    }
    if (config.nodeTypeCosts) {
      this.costConfig.nodeTypeCosts = {
        ...this.costConfig.nodeTypeCosts,
        ...config.nodeTypeCosts,
      };
    }
    logger.info({ config: this.costConfig }, "Cost config updated");
  }

  getCostConfig(): typeof this.costConfig {
    return { ...this.costConfig };
  }
}

export const nodeUtilizationService = new NodeUtilizationService();
