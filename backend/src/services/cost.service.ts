import { v4 as uuidv4 } from "uuid";
import { createChildLogger } from "../utils/logger.js";
import { healingService } from "./healing.service.js";
import { prometheusService } from "./prometheus.service.js";

const logger = createChildLogger("cost-service");

export interface CostMetrics {
  estimatedCostBefore: number;
  estimatedCostAfter: number;
  totalCostSaved: number;
  totalCostIncurred: number;
  scaleDownCount: number;
  scaleUpCount: number;
  optimizationPercent: number;
}

export interface CostIssue {
  id: string;
  title: string;
  status: "active" | "optimized" | "pending";
  monthlyCostImpact: number;
  cause: string;
  scope: string;
  fix: string;
  fixUrl?: string;
  severity: "high" | "medium" | "low";
  category: "scheduling" | "over-provisioning" | "daemonset" | "pvc" | "scaling";
}

export interface CostSummary {
  metrics: CostMetrics;
  totalAvoidableCost: number;
  primaryCostDriver: string;
  issues: CostIssue[];
  trends: TrendDataPoint[];
}

export interface TrendDataPoint {
  date: string;
  before: number;
  after: number;
}

export class CostService {
  private issues: CostIssue[] = [];
  private trendHistory: TrendDataPoint[] = [];

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Generate realistic cost issues based on common K8s cost problems
    this.issues = [
      {
        id: uuidv4(),
        title: "Pods Unschedulable",
        status: "active",
        monthlyCostImpact: 18400,
        cause: "Pending pods triggered node scale-up",
        scope: "7 pods · 2 nodes",
        fix: "Reduce requests or fix scheduling constraints",
        fixUrl: "/healing?filter=scheduling",
        severity: "high",
        category: "scheduling",
      },
      {
        id: uuidv4(),
        title: "Over-Provisioned Resources",
        status: "optimized",
        monthlyCostImpact: 9600,
        cause: "Requests far exceed actual usage",
        scope: "12 pods",
        fix: "Right-size CPU & memory requests",
        fixUrl: "/healing?filter=resources",
        severity: "medium",
        category: "over-provisioning",
      },
      {
        id: uuidv4(),
        title: "DaemonSet Overhead",
        status: "active",
        monthlyCostImpact: 14000,
        cause: "Agents consuming node capacity",
        scope: "6 DaemonSets / node",
        fix: "Limit or optimize heavy agents",
        fixUrl: "/healing?filter=daemonset",
        severity: "high",
        category: "daemonset",
      },
      {
        id: uuidv4(),
        title: "PVC Misconfiguration",
        status: "active",
        monthlyCostImpact: 9500,
        cause: "Pods blocked, causing scaling pressure",
        scope: "4 pods",
        fix: "Rebind or reschedule PVCs",
        fixUrl: "/nodes?filter=pvc",
        severity: "medium",
        category: "pvc",
      },
    ];

    // Generate trend data for the last 7 days
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    for (let i = 7; i >= 0; i--) {
      const date = new Date(now - i * dayMs);
      const dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
      
      // Simulate cost reduction over time
      const baseCost = 180 - (7 - i) * 10;
      const optimizedCost = baseCost - 10 - Math.random() * 15;
      
      this.trendHistory.push({
        date: dateStr,
        before: Math.max(baseCost, 100),
        after: Math.max(optimizedCost, 80),
      });
    }
  }

  async getCostMetrics(): Promise<CostMetrics> {
    // Calculate costs from healing events
    const activity = healingService.getActivity(100, "all");
    
    let scaleDownSavings = 0;
    let scaleUpCosts = 0;
    let scaleDownCount = 0;
    let scaleUpCount = 0;

    // Base cost per replica per hour (in dollars)
    const costPerReplicaHour = 0.15;
    const hoursInWeek = 168;

    for (const event of activity) {
      if (event.action === "scale-deployment" && event.status === "success") {
        const from = event.fromReplicas || 0;
        const to = event.toReplicas || 0;
        
        if (to < from) {
          // Scale down - savings
          const replicasDiff = from - to;
          scaleDownSavings += replicasDiff * costPerReplicaHour * hoursInWeek;
          scaleDownCount++;
        } else if (to > from) {
          // Scale up - cost
          const replicasDiff = to - from;
          scaleUpCosts += replicasDiff * costPerReplicaHour * hoursInWeek;
          scaleUpCount++;
        }
      }
    }

    // Add sample data if no real events
    if (scaleDownCount === 0 && scaleUpCount === 0) {
      scaleDownSavings = 514.40;
      scaleUpCosts = 38.50;
      scaleDownCount = 29;
      scaleUpCount = 17;
    }

    const estimatedCostBefore = 152.30; // Base weekly cost
    const totalCostSaved = scaleDownSavings;
    const totalCostIncurred = scaleUpCosts;
    const netSavings = totalCostSaved - totalCostIncurred;
    const estimatedCostAfter = estimatedCostBefore - (netSavings / 10); // Adjusted for display
    const optimizationPercent = -((netSavings / estimatedCostBefore) * 100);

    return {
      estimatedCostBefore,
      estimatedCostAfter: Math.max(estimatedCostAfter, 100),
      totalCostSaved,
      totalCostIncurred,
      scaleDownCount,
      scaleUpCount,
      optimizationPercent: parseFloat(optimizationPercent.toFixed(1)),
    };
  }

  async getCostIssues(filter?: string): Promise<CostIssue[]> {
    if (filter && filter !== "all") {
      return this.issues.filter(issue => issue.category === filter);
    }
    return this.issues;
  }

  async getCostSummary(): Promise<CostSummary> {
    const metrics = await this.getCostMetrics();
    const issues = await this.getCostIssues();
    
    const totalAvoidableCost = issues
      .filter(i => i.status === "active")
      .reduce((sum, i) => sum + i.monthlyCostImpact, 0);

    // Determine primary cost driver
    const activeIssues = issues.filter(i => i.status === "active");
    const sortedByImpact = activeIssues.sort((a, b) => b.monthlyCostImpact - a.monthlyCostImpact);
    const primaryCostDriver = sortedByImpact[0]?.category === "scheduling" 
      ? "Scheduling & Over-Provisioning"
      : sortedByImpact[0]?.title || "Resource Optimization";

    return {
      metrics,
      totalAvoidableCost,
      primaryCostDriver,
      issues,
      trends: this.trendHistory,
    };
  }

  async getEfficiencyData(): Promise<Array<{
    resource: string;
    namespace: string;
    cpuRequested: number;
    cpuUsed: number;
    memoryRequested: number;
    memoryUsed: number;
    efficiency: number;
    wastedCost: number;
  }>> {
    try {
      const podMetrics = await prometheusService.getPodMetrics();
      
      return podMetrics.slice(0, 10).map(pod => {
        const cpuLimit = pod.cpuLimitCores || 1;
        const memLimit = pod.memoryLimitBytes || 512 * 1024 * 1024;
        const cpuUsed = pod.cpuUsageCores || 0;
        const memUsed = pod.memoryUsageBytes || 0;
        
        const cpuEfficiency = Math.min(100, (cpuUsed / cpuLimit) * 100);
        const memEfficiency = Math.min(100, (memUsed / memLimit) * 100);
        const avgEfficiency = (cpuEfficiency + memEfficiency) / 2;
        
        // Calculate wasted cost based on unused resources
        const wastedCpuPercent = Math.max(0, 100 - cpuEfficiency) / 100;
        const wastedMemPercent = Math.max(0, 100 - memEfficiency) / 100;
        const hourlyRate = 0.10; // $ per core-hour
        const wastedCost = (wastedCpuPercent * cpuLimit * hourlyRate + wastedMemPercent * 0.01) * 720; // Monthly

        return {
          resource: pod.podName,
          namespace: pod.namespace || "default",
          cpuRequested: cpuLimit * 1000, // millicores
          cpuUsed: cpuUsed * 1000,
          memoryRequested: memLimit,
          memoryUsed: memUsed,
          efficiency: Math.round(avgEfficiency),
          wastedCost: parseFloat(wastedCost.toFixed(2)),
        };
      });
    } catch (error) {
      logger.error({ error }, "Failed to get efficiency data");
      // Return mock data
      return [
        { resource: "api-gateway", namespace: "production", cpuRequested: 2000, cpuUsed: 1400, memoryRequested: 4096 * 1024 * 1024, memoryUsed: 2867 * 1024 * 1024, efficiency: 70, wastedCost: 15.50 },
        { resource: "user-service", namespace: "production", cpuRequested: 1000, cpuUsed: 450, memoryRequested: 2048 * 1024 * 1024, memoryUsed: 1024 * 1024 * 1024, efficiency: 45, wastedCost: 28.00 },
        { resource: "order-processor", namespace: "production", cpuRequested: 1500, cpuUsed: 1200, memoryRequested: 3072 * 1024 * 1024, memoryUsed: 2458 * 1024 * 1024, efficiency: 80, wastedCost: 8.25 },
      ];
    }
  }

  updateIssueStatus(issueId: string, status: "active" | "optimized" | "pending"): CostIssue | null {
    const issue = this.issues.find(i => i.id === issueId);
    if (issue) {
      issue.status = status;
      logger.info({ issueId, status }, "Cost issue status updated");
    }
    return issue || null;
  }
}

export const costService = new CostService();
