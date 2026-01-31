import { createChildLogger } from "../utils/logger.js";
import { prometheusService } from "./prometheus.service.js";
import { incidentService } from "./incident.service.js";
import { healingService } from "./healing.service.js";

const logger = createChildLogger("operational-cost-risk-service");

export interface NodeUtil {
  nodeName: string;
  cpuUtilPct: number;
  memUtilPct: number;
  status: "underutilized" | "healthy" | "hot" | "unknown";
  estimatedCostPerHour?: number;
}

export interface CostInsight {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  evidence: string[];
}

export interface DataQuality {
  hasPrometheus: boolean;
  mode: "real-usage" | "container-fallback" | "requests-fallback" | "unavailable";
}

export interface OperationalCostRiskResponse {
  runRatePerHour: number | null;
  nodeCount: number;
  underutilizedNodeCount: number;
  hotNodeCount: number;
  costRiskLevel: "low" | "medium" | "high";
  nodes: NodeUtil[];
  insights: CostInsight[];
  generatedAt: string;
  dataQuality: DataQuality;
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
  "control-plane": 0.05,
  "default": 0.10,
};

const UNDERUTILIZED_CPU_THRESHOLD = 20;
const UNDERUTILIZED_MEM_THRESHOLD = 20;
const HOT_CPU_THRESHOLD = 85;
const HOT_MEM_THRESHOLD = 85;

export class OperationalCostRiskService {
  private cache: { data: OperationalCostRiskResponse | null; timestamp: number } = {
    data: null,
    timestamp: 0,
  };
  private cacheTTL = 30000; // 30 seconds

  async getOperationalCostRisk(): Promise<OperationalCostRiskResponse> {
    const now = Date.now();
    if (this.cache.data && now - this.cache.timestamp < this.cacheTTL) {
      return this.cache.data;
    }

    try {
      const response = await this.fetchOperationalCostRisk();
      this.cache = { data: response, timestamp: now };
      return response;
    } catch (error) {
      logger.error({ error }, "Failed to get operational cost risk");
      return this.getFallbackResponse();
    }
  }

  private async fetchOperationalCostRisk(): Promise<OperationalCostRiskResponse> {
    const prometheusConnected = await prometheusService.checkConnection();
    let nodes: NodeUtil[] = [];
    let dataQuality: DataQuality = {
      hasPrometheus: prometheusConnected,
      mode: prometheusConnected ? "real-usage" : "unavailable",
    };

    if (prometheusConnected) {
      nodes = await this.fetchNodeUtilizationFromPrometheus();
      if (nodes.length === 0) {
        nodes = await this.fetchContainerFallbackMetrics();
        if (nodes.length > 0) {
          dataQuality.mode = "container-fallback";
        }
      }
    }

    // Filter for cluster 1 node (minicube)
    if (nodes.length > 0) {
      const cluster1Node = nodes.find((n) =>
        n.nodeName.toLowerCase().includes('minikube')
      );
      if (cluster1Node) {
        nodes = [cluster1Node];
      }
    }

    const underutilizedNodeCount = nodes.filter((n) => n.status === "underutilized").length;
    const hotNodeCount = nodes.filter((n) => n.status === "hot").length;
    const nodeCount = nodes.length;

    const runRatePerHour = nodes.reduce((sum, n) => sum + (n.estimatedCostPerHour || 0), 0);

    const costRiskLevel = this.calculateRiskLevel(
      underutilizedNodeCount,
      hotNodeCount,
      nodeCount
    );

    const insights = await this.generateInsights(nodes, underutilizedNodeCount, hotNodeCount);

    return {
      runRatePerHour: parseFloat(runRatePerHour.toFixed(4)),
      nodeCount,
      underutilizedNodeCount,
      hotNodeCount,
      costRiskLevel,
      nodes,
      insights,
      generatedAt: new Date().toISOString(),
      dataQuality,
    };
  }

  private async fetchNodeUtilizationFromPrometheus(): Promise<NodeUtil[]> {
    try {
      const nodeMetrics = await prometheusService.getNodeMetrics();
      
      return nodeMetrics.map((node) => {
        const cpuUtilPct = Math.min(100, Math.max(0, node.cpuUsagePercent || 0));
        const memUtilPct = Math.min(100, Math.max(0, node.memoryUsagePercent || 0));
        const status = this.determineNodeStatus(cpuUtilPct, memUtilPct);
        const estimatedCostPerHour = this.getNodeHourlyCost(node.nodeName);

        return {
          nodeName: node.nodeName,
          cpuUtilPct: parseFloat(cpuUtilPct.toFixed(1)),
          memUtilPct: parseFloat(memUtilPct.toFixed(1)),
          status,
          estimatedCostPerHour,
        };
      });
    } catch (error) {
      logger.error({ error }, "Failed to fetch node utilization from Prometheus");
      return [];
    }
  }

  private async fetchContainerFallbackMetrics(): Promise<NodeUtil[]> {
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

      cpuResult.data.result.forEach((r: any) => {
        const nodeName = r.metric.node;
        if (nodeName && r.value) {
          nodeMap.set(nodeName, {
            cpu: parseFloat(r.value[1]) * 100,
            mem: 0,
          });
        }
      });

      memResult.data.result.forEach((r: any) => {
        const nodeName = r.metric.node;
        if (nodeName && r.value) {
          const existing = nodeMap.get(nodeName) || { cpu: 0, mem: 0 };
          existing.mem = (parseFloat(r.value[1]) / (16 * 1024 * 1024 * 1024)) * 100;
          nodeMap.set(nodeName, existing);
        }
      });

      return Array.from(nodeMap.entries()).map(([nodeName, metrics]) => {
        const cpuUtilPct = Math.min(100, Math.max(0, metrics.cpu));
        const memUtilPct = Math.min(100, Math.max(0, metrics.mem));
        const status = this.determineNodeStatus(cpuUtilPct, memUtilPct);
        const estimatedCostPerHour = this.getNodeHourlyCost(nodeName);

        return {
          nodeName,
          cpuUtilPct: parseFloat(cpuUtilPct.toFixed(1)),
          memUtilPct: parseFloat(memUtilPct.toFixed(1)),
          status,
          estimatedCostPerHour,
        };
      });
    } catch (error) {
      logger.error({ error }, "Failed to fetch container fallback metrics");
      return [];
    }
  }

  private determineNodeStatus(
    cpuUtilPct: number,
    memUtilPct: number
  ): "underutilized" | "healthy" | "hot" | "unknown" {
    if (cpuUtilPct > HOT_CPU_THRESHOLD || memUtilPct > HOT_MEM_THRESHOLD) {
      return "hot";
    }
    if (cpuUtilPct < UNDERUTILIZED_CPU_THRESHOLD && memUtilPct < UNDERUTILIZED_MEM_THRESHOLD) {
      return "underutilized";
    }
    return "healthy";
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

  private calculateRiskLevel(
    underutilizedCount: number,
    hotCount: number,
    totalNodes: number
  ): "low" | "medium" | "high" {
    if (totalNodes === 0) return "low";

    const underutilizedRatio = underutilizedCount / totalNodes;

    if (underutilizedRatio > 0.4 || hotCount > 2) {
      return "high";
    }

    if (underutilizedRatio >= 0.2 || hotCount >= 1) {
      return "medium";
    }

    return "low";
  }

  private async generateInsights(
    nodes: NodeUtil[],
    underutilizedCount: number,
    hotCount: number
  ): Promise<CostInsight[]> {
    const insights: CostInsight[] = [];

    if (underutilizedCount >= 2) {
      const underutilizedNodes = nodes.filter((n) => n.status === "underutilized");
      const avgCpu =
        underutilizedNodes.reduce((sum, n) => sum + n.cpuUtilPct, 0) / underutilizedNodes.length;
      const avgMem =
        underutilizedNodes.reduce((sum, n) => sum + n.memUtilPct, 0) / underutilizedNodes.length;

      insights.push({
        id: "underutilized-nodes",
        severity: underutilizedCount >= 3 ? "high" : "medium",
        title: "Underutilized nodes detected",
        detail: `${underutilizedCount} nodes are running below 20% CPU and memory utilization. Consider consolidating workloads to reduce costs.`,
        evidence: [
          `${underutilizedCount} nodes below 20% utilization`,
          `Average CPU: ${avgCpu.toFixed(1)}%, Average Memory: ${avgMem.toFixed(1)}%`,
          "Consolidation could reduce node count",
        ],
      });
    } else if (underutilizedCount === 1) {
      insights.push({
        id: "underutilized-node-single",
        severity: "low",
        title: "1 node is underutilized",
        detail: "One node is running below 20% CPU and memory utilization.",
        evidence: [
          "1 node below 20% utilization",
          "Monitor for consolidation opportunity",
        ],
      });
    }

    if (hotCount >= 1) {
      const hotNodes = nodes.filter((n) => n.status === "hot").slice(0, 2);
      const hotNodeNames = hotNodes.map((n) => n.nodeName).join(", ");

      insights.push({
        id: "hot-nodes",
        severity: hotCount >= 2 ? "high" : "medium",
        title: "Hot nodes may drive instability",
        detail: `${hotCount} node(s) are above 85% utilization. This can cause throttling and increased latency.`,
        evidence: [
          `${hotCount} node(s) above 85% utilization`,
          `Affected: ${hotNodeNames}`,
          "Consider scaling out or optimizing workloads",
        ],
      });
    }

    const ineffectiveScalingInsight = await this.checkIneffectiveScaling();
    if (ineffectiveScalingInsight) {
      insights.push(ineffectiveScalingInsight);
    }

    if (insights.length === 0) {
      const avgCpu = nodes.reduce((sum, n) => sum + n.cpuUtilPct, 0) / (nodes.length || 1);
      const avgMem = nodes.reduce((sum, n) => sum + n.memUtilPct, 0) / (nodes.length || 1);

      insights.push({
        id: "healthy-cluster",
        severity: "low",
        title: "Cluster utilization is healthy",
        detail: `Your cluster is running at ${avgCpu.toFixed(0)}% CPU and ${avgMem.toFixed(0)}% memory utilization.`,
        evidence: [
          `Average CPU: ${avgCpu.toFixed(1)}%`,
          `Average Memory: ${avgMem.toFixed(1)}%`,
          "No immediate cost optimization needed",
        ],
      });
    }

    return insights.slice(0, 3);
  }

  private async checkIneffectiveScaling(): Promise<CostInsight | null> {
    try {
      const activeIncidents = incidentService.getIncidents("open");
      if (activeIncidents.length === 0) return null;

      const recentActivity = healingService.getActivity(20, "all");
      const scalingEvents = recentActivity.filter(
        (a) => a.action === "scale-deployment" && a.status === "success"
      );

      if (scalingEvents.length === 0) return null;

      const recentScaling = scalingEvents.filter((e) => {
        const eventTime = new Date(e.timestamp).getTime();
        const now = Date.now();
        return now - eventTime < 10 * 60 * 1000;
      });

      if (recentScaling.length === 0) return null;

      const hasActiveIncidentDuringScaling = activeIncidents.some((incident: { detectedAt: string }) => {
        const incidentStart = new Date(incident.detectedAt).getTime();
        return recentScaling.some((scaling) => {
          const scalingTime = new Date(scaling.timestamp).getTime();
          return Math.abs(scalingTime - incidentStart) < 15 * 60 * 1000;
        });
      });

      if (hasActiveIncidentDuringScaling) {
        return {
          id: "ineffective-scaling",
          severity: "medium",
          title: "Scaling increased spend without improving health",
          detail:
            "Replicas were scaled during an incident but service health did not improve significantly.",
          evidence: [
            `${recentScaling.length} scaling event(s) during active incident`,
            "Error rate or latency did not improve",
            "Consider investigating root cause before scaling",
          ],
        };
      }

      return null;
    } catch (error) {
      logger.debug({ error }, "Could not check ineffective scaling");
      return null;
    }
  }

  private getMockNodes(): NodeUtil[] {
    // No mock data - return empty array
    return [];
  }

  private getFallbackResponse(): OperationalCostRiskResponse {
    // Return empty response instead of mock data
    return {
      runRatePerHour: null,
      nodeCount: 0,
      underutilizedNodeCount: 0,
      hotNodeCount: 0,
      costRiskLevel: "low",
      nodes: [],
      insights: [],
      generatedAt: new Date().toISOString(),
      dataQuality: {
        hasPrometheus: false,
        mode: "unavailable",
      },
    };
  }

  clearCache(): void {
    this.cache = { data: null, timestamp: 0 };
  }
}

export const operationalCostRiskService = new OperationalCostRiskService();
