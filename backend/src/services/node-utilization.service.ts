import { prometheusService } from "./prometheus.service.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("node-utilization-service");

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
  "control-plane": 0.05,
  "default": 0.10,
};

const UNDERUTILIZED_THRESHOLD = 20;
const SATURATED_THRESHOLD = 85;
const WASTE_THRESHOLD = 30;

export interface NodeUtilData {
  nodeName: string;
  cpuUsedCores: number;
  cpuCapacityCores: number;
  cpuUtilPct: number;
  memUsedBytes: number;
  memCapacityBytes: number;
  memUtilPct: number;
  status: "underutilized" | "healthy" | "saturated";
  wasteScore: number;
  estimatedCostPerHour: number;
}

export interface ClusterSummary {
  totalNodes: number;
  avgCpuUtil: number;
  avgMemUtil: number;
  p90CpuUtil: number;
  p90MemUtil: number;
  underutilizedNodes: number;
  saturatedNodes: number;
  healthyNodes: number;
  runRatePerHour: number;
  idleCpuCores: number;
  idleMemoryGB: number;
  totalCpuCores: number;
  totalMemoryGB: number;
}

export interface CostInsight {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  evidence: string[];
  potentialSavings?: number;
}

export interface NodeUtilizationResponse {
  nodes: NodeUtilData[];
  summary: ClusterSummary;
  insights: CostInsight[];
  dataQuality: {
    hasPrometheus: boolean;
    mode: "real-usage" | "container-fallback" | "unavailable";
  };
  generatedAt: string;
}

export class NodeUtilizationService {
  private cache: { data: NodeUtilizationResponse | null; timestamp: number } = {
    data: null,
    timestamp: 0,
  };
  private cacheTTL = 30000;

  async getNodeUtilizationData(): Promise<NodeUtilizationResponse> {
    const now = Date.now();
    if (this.cache.data && now - this.cache.timestamp < this.cacheTTL) {
      return this.cache.data;
    }

    try {
      const response = await this.fetchNodeUtilization();
      this.cache = { data: response, timestamp: now };
      return response;
    } catch (error) {
      logger.error({ error }, "Failed to get node utilization data");
      return this.getFallbackResponse();
    }
  }

  private async fetchNodeUtilization(): Promise<NodeUtilizationResponse> {
    const prometheusConnected = await prometheusService.checkConnection();
    let nodes: NodeUtilData[] = [];
    let dataQuality: NodeUtilizationResponse["dataQuality"] = {
      hasPrometheus: prometheusConnected,
      mode: prometheusConnected ? "real-usage" : "unavailable",
    };

    if (prometheusConnected) {
      nodes = await this.fetchFromPrometheus();
      if (nodes.length === 0) {
        nodes = await this.fetchContainerFallback();
        if (nodes.length > 0) {
          dataQuality.mode = "container-fallback";
        }
      }
    }

    const summary = this.calculateClusterSummary(nodes);
    const insights = this.generateInsights(nodes, summary);

    return {
      nodes: nodes.sort((a, b) => b.wasteScore - a.wasteScore),
      summary,
      insights,
      dataQuality,
      generatedAt: new Date().toISOString(),
    };
  }

  private async fetchFromPrometheus(): Promise<NodeUtilData[]> {
    try {
      const nodeMetrics = await prometheusService.getNodeMetrics();

      return nodeMetrics.map((node) => {
        const cpuUtilPct = Math.min(100, Math.max(0, node.cpuUsagePercent || 0));
        const memUtilPct = Math.min(100, Math.max(0, node.memoryUsagePercent || 0));
        const status = this.determineStatus(cpuUtilPct, memUtilPct);
        const wasteScore = this.calculateWasteScore(cpuUtilPct, memUtilPct);
        const estimatedCostPerHour = this.getNodeHourlyCost(node.nodeName);

        return {
          nodeName: node.nodeName,
          cpuUsedCores: node.cpuUsedCores || 0,
          cpuCapacityCores: node.cpuTotalCores || 1,
          cpuUtilPct: parseFloat(cpuUtilPct.toFixed(1)),
          memUsedBytes: node.memoryUsageBytes || 0,
          memCapacityBytes: node.memoryTotalBytes || 1,
          memUtilPct: parseFloat(memUtilPct.toFixed(1)),
          status,
          wasteScore: parseFloat(wasteScore.toFixed(2)),
          estimatedCostPerHour,
        };
      });
    } catch (error) {
      logger.error({ error }, "Failed to fetch from Prometheus");
      return [];
    }
  }

  private async fetchContainerFallback(): Promise<NodeUtilData[]> {
    try {
      const cpuResult = await prometheusService.query(
        'sum(rate(container_cpu_usage_seconds_total{image!=""}[5m])) by (node)'
      );
      const memResult = await prometheusService.query(
        'sum(container_memory_working_set_bytes{image!=""}) by (node)'
      );

      if (!cpuResult?.data?.result || !memResult?.data?.result) {
        return [];
      }

      const nodeMap = new Map<string, { cpu: number; mem: number }>();
      const defaultCpuCapacity = 4;
      const defaultMemCapacity = 16 * 1024 * 1024 * 1024;

      cpuResult.data.result.forEach((r: any) => {
        const nodeName = r.metric.node;
        if (nodeName && r.value) {
          nodeMap.set(nodeName, {
            cpu: parseFloat(r.value[1]),
            mem: 0,
          });
        }
      });

      memResult.data.result.forEach((r: any) => {
        const nodeName = r.metric.node;
        if (nodeName && r.value) {
          const existing = nodeMap.get(nodeName) || { cpu: 0, mem: 0 };
          existing.mem = parseFloat(r.value[1]);
          nodeMap.set(nodeName, existing);
        }
      });

      return Array.from(nodeMap.entries()).map(([nodeName, metrics]) => {
        const cpuUtilPct = Math.min(100, (metrics.cpu / defaultCpuCapacity) * 100);
        const memUtilPct = Math.min(100, (metrics.mem / defaultMemCapacity) * 100);
        const status = this.determineStatus(cpuUtilPct, memUtilPct);
        const wasteScore = this.calculateWasteScore(cpuUtilPct, memUtilPct);

        return {
          nodeName,
          cpuUsedCores: metrics.cpu,
          cpuCapacityCores: defaultCpuCapacity,
          cpuUtilPct: parseFloat(cpuUtilPct.toFixed(1)),
          memUsedBytes: metrics.mem,
          memCapacityBytes: defaultMemCapacity,
          memUtilPct: parseFloat(memUtilPct.toFixed(1)),
          status,
          wasteScore: parseFloat(wasteScore.toFixed(2)),
          estimatedCostPerHour: this.getNodeHourlyCost(nodeName),
        };
      });
    } catch (error) {
      logger.error({ error }, "Failed to fetch container fallback metrics");
      return [];
    }
  }

  private determineStatus(cpuUtil: number, memUtil: number): "underutilized" | "healthy" | "saturated" {
    if (cpuUtil > SATURATED_THRESHOLD || memUtil > SATURATED_THRESHOLD) {
      return "saturated";
    }
    if (cpuUtil < UNDERUTILIZED_THRESHOLD && memUtil < UNDERUTILIZED_THRESHOLD) {
      return "underutilized";
    }
    return "healthy";
  }

  private calculateWasteScore(cpuUtil: number, memUtil: number): number {
    const cpuWaste = Math.max(0, WASTE_THRESHOLD - cpuUtil) / 100;
    const memWaste = Math.max(0, WASTE_THRESHOLD - memUtil) / 100;
    return cpuWaste + memWaste;
  }

  private getNodeHourlyCost(nodeName: string): number {
    const lowerName = nodeName.toLowerCase();
    for (const [type, cost] of Object.entries(NODE_TYPE_COSTS)) {
      if (lowerName.includes(type.toLowerCase())) {
        return cost;
      }
    }
    return DEFAULT_NODE_HOURLY_COST;
  }

  private calculateClusterSummary(nodes: NodeUtilData[]): ClusterSummary {
    if (nodes.length === 0) {
      return {
        totalNodes: 0,
        avgCpuUtil: 0,
        avgMemUtil: 0,
        p90CpuUtil: 0,
        p90MemUtil: 0,
        underutilizedNodes: 0,
        saturatedNodes: 0,
        healthyNodes: 0,
        runRatePerHour: 0,
        idleCpuCores: 0,
        idleMemoryGB: 0,
        totalCpuCores: 0,
        totalMemoryGB: 0,
      };
    }

    const cpuUtils = nodes.map((n) => n.cpuUtilPct).sort((a, b) => a - b);
    const memUtils = nodes.map((n) => n.memUtilPct).sort((a, b) => a - b);

    const p90Index = Math.floor(nodes.length * 0.9);
    const p90CpuUtil = cpuUtils[Math.min(p90Index, cpuUtils.length - 1)];
    const p90MemUtil = memUtils[Math.min(p90Index, memUtils.length - 1)];

    const totalCpuCores = nodes.reduce((sum, n) => sum + n.cpuCapacityCores, 0);
    const usedCpuCores = nodes.reduce((sum, n) => sum + n.cpuUsedCores, 0);
    const totalMemBytes = nodes.reduce((sum, n) => sum + n.memCapacityBytes, 0);
    const usedMemBytes = nodes.reduce((sum, n) => sum + n.memUsedBytes, 0);

    return {
      totalNodes: nodes.length,
      avgCpuUtil: parseFloat((cpuUtils.reduce((a, b) => a + b, 0) / nodes.length).toFixed(1)),
      avgMemUtil: parseFloat((memUtils.reduce((a, b) => a + b, 0) / nodes.length).toFixed(1)),
      p90CpuUtil: parseFloat(p90CpuUtil.toFixed(1)),
      p90MemUtil: parseFloat(p90MemUtil.toFixed(1)),
      underutilizedNodes: nodes.filter((n) => n.status === "underutilized").length,
      saturatedNodes: nodes.filter((n) => n.status === "saturated").length,
      healthyNodes: nodes.filter((n) => n.status === "healthy").length,
      runRatePerHour: parseFloat(nodes.reduce((sum, n) => sum + n.estimatedCostPerHour, 0).toFixed(2)),
      idleCpuCores: parseFloat((totalCpuCores - usedCpuCores).toFixed(2)),
      idleMemoryGB: parseFloat(((totalMemBytes - usedMemBytes) / (1024 * 1024 * 1024)).toFixed(2)),
      totalCpuCores: parseFloat(totalCpuCores.toFixed(2)),
      totalMemoryGB: parseFloat((totalMemBytes / (1024 * 1024 * 1024)).toFixed(2)),
    };
  }

  private generateInsights(nodes: NodeUtilData[], summary: ClusterSummary): CostInsight[] {
    const insights: CostInsight[] = [];

    if (summary.underutilizedNodes >= 1) {
      const underutilizedNodes = nodes.filter((n) => n.status === "underutilized");
      const avgCpu = underutilizedNodes.reduce((sum, n) => sum + n.cpuUtilPct, 0) / underutilizedNodes.length;
      const avgMem = underutilizedNodes.reduce((sum, n) => sum + n.memUtilPct, 0) / underutilizedNodes.length;
      const potentialSavings = underutilizedNodes.reduce((sum, n) => sum + n.estimatedCostPerHour, 0) * 0.5;

      insights.push({
        id: "underutilized-consolidation",
        severity: summary.underutilizedNodes >= 2 ? "high" : "medium",
        title: `${summary.underutilizedNodes} node${summary.underutilizedNodes > 1 ? "s" : ""} below 20% utilization`,
        detail: "Consider consolidating workloads to reduce node count and save costs.",
        evidence: [
          `${summary.underutilizedNodes} of ${summary.totalNodes} nodes underutilized`,
          `Average CPU: ${avgCpu.toFixed(1)}%, Average Memory: ${avgMem.toFixed(1)}%`,
          `Potential consolidation opportunity`,
        ],
        potentialSavings: parseFloat(potentialSavings.toFixed(2)),
      });
    }

    if (summary.idleCpuCores > 0 || summary.idleMemoryGB > 0) {
      insights.push({
        id: "idle-capacity",
        severity: "low",
        title: "Idle capacity detected",
        detail: `You have ${summary.idleCpuCores.toFixed(1)} CPU cores and ${summary.idleMemoryGB.toFixed(1)} GB memory sitting idle.`,
        evidence: [
          `Total capacity: ${summary.totalCpuCores.toFixed(1)} cores, ${summary.totalMemoryGB.toFixed(1)} GB`,
          `Idle: ${summary.idleCpuCores.toFixed(1)} cores (${((summary.idleCpuCores / summary.totalCpuCores) * 100).toFixed(0)}%), ${summary.idleMemoryGB.toFixed(1)} GB (${((summary.idleMemoryGB / summary.totalMemoryGB) * 100).toFixed(0)}%)`,
          "Scaling up isn't the issue — you're paying for unused headroom",
        ],
      });
    }

    if (summary.saturatedNodes >= 1) {
      const saturatedNodes = nodes.filter((n) => n.status === "saturated");
      const nodeNames = saturatedNodes.slice(0, 2).map((n) => n.nodeName).join(", ");

      insights.push({
        id: "saturated-nodes",
        severity: summary.saturatedNodes >= 2 ? "high" : "medium",
        title: `${summary.saturatedNodes} node${summary.saturatedNodes > 1 ? "s" : ""} running hot (>85%)`,
        detail: "High utilization may cause throttling and increased latency.",
        evidence: [
          `Affected nodes: ${nodeNames}${saturatedNodes.length > 2 ? ` (+${saturatedNodes.length - 2} more)` : ""}`,
          "Consider scaling out or optimizing workloads",
        ],
      });
    }

    if (summary.avgCpuUtil < 30 && summary.avgMemUtil < 30 && summary.totalNodes > 1) {
      const conservativeRemovable = Math.floor(summary.totalNodes * 0.15);
      const potentialSavings = conservativeRemovable * (summary.runRatePerHour / summary.totalNodes);

      if (conservativeRemovable >= 1) {
        insights.push({
          id: "consolidation-recommendation",
          severity: "medium",
          title: "Consolidation opportunity",
          detail: `With average utilization at ${summary.avgCpuUtil.toFixed(0)}% CPU and ${summary.avgMemUtil.toFixed(0)}% memory, you may be able to reduce node count.`,
          evidence: [
            `Estimated removable nodes: ${conservativeRemovable} (conservative)`,
            `Potential savings: ~$${potentialSavings.toFixed(2)}/hr (~$${(potentialSavings * 730).toFixed(0)}/month)`,
            "Reduce minimum nodes in cluster autoscaler",
          ],
          potentialSavings: parseFloat(potentialSavings.toFixed(2)),
        });
      }
    }

    if (insights.length === 0) {
      insights.push({
        id: "healthy-cluster",
        severity: "low",
        title: "Cluster utilization is healthy",
        detail: `Your cluster is running at ${summary.avgCpuUtil.toFixed(0)}% CPU and ${summary.avgMemUtil.toFixed(0)}% memory utilization.`,
        evidence: [
          `Average CPU: ${summary.avgCpuUtil.toFixed(1)}%`,
          `Average Memory: ${summary.avgMemUtil.toFixed(1)}%`,
          "No immediate cost optimization needed",
        ],
      });
    }

    return insights.slice(0, 4);
  }

  private getFallbackResponse(): NodeUtilizationResponse {
    return {
      nodes: [],
      summary: {
        totalNodes: 0,
        avgCpuUtil: 0,
        avgMemUtil: 0,
        p90CpuUtil: 0,
        p90MemUtil: 0,
        underutilizedNodes: 0,
        saturatedNodes: 0,
        healthyNodes: 0,
        runRatePerHour: 0,
        idleCpuCores: 0,
        idleMemoryGB: 0,
        totalCpuCores: 0,
        totalMemoryGB: 0,
      },
      insights: [],
      dataQuality: {
        hasPrometheus: false,
        mode: "unavailable",
      },
      generatedAt: new Date().toISOString(),
    };
  }

  getCostConfig() {
    return {
      defaultNodeHourlyCost: DEFAULT_NODE_HOURLY_COST,
      nodeTypeCosts: NODE_TYPE_COSTS,
    };
  }

  updateCostConfig({ defaultNodeHourlyCost, nodeTypeCosts }: {
    defaultNodeHourlyCost?: number;
    nodeTypeCosts?: Record<string, number>;
  }) {
    if (defaultNodeHourlyCost !== undefined) {
      logger.info({ defaultNodeHourlyCost }, "Updating default node hourly cost");
    }
    if (nodeTypeCosts !== undefined) {
      logger.info({ nodeTypeCosts }, "Updating node type costs");
    }
    return this.getCostConfig();
  }

  clearCache(): void {
    this.cache = { data: null, timestamp: 0 };
  }
}

export const nodeUtilizationService = new NodeUtilizationService();
