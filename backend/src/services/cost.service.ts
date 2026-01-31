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
    // Initialize empty arrays - no dummy data
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

    // If no real events, return zeros
    if (scaleDownCount === 0 && scaleUpCount === 0) {
      return {
        estimatedCostBefore: 0,
        estimatedCostAfter: 0,
        totalCostSaved: 0,
        totalCostIncurred: 0,
        scaleDownCount: 0,
        scaleUpCount: 0,
        optimizationPercent: 0,
      };
    }

    const estimatedCostBefore = scaleDownSavings + scaleUpCosts;
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

    // Generate trend data from healing activity
    const trendHistory: TrendDataPoint[] = [];
    const activity = healingService.getActivity(50, "all");
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    for (let i = 7; i >= 0; i--) {
      const date = new Date(now - i * dayMs);
      const dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
      
      // Calculate costs from activity for this day
      const dayActivity = activity.filter((event) => {
        const eventTime = new Date(event.timestamp).getTime();
        const eventDate = new Date(now - i * dayMs);
        return eventTime >= eventDate.getTime() && eventTime < eventDate.getTime() + dayMs;
      });
      
      let dayCostBefore = 0;
      let dayCostAfter = 0;
      const costPerReplicaHour = 0.15;
      
      for (const event of dayActivity) {
        if (event.action === "scale-deployment" && event.status === "success") {
          const from = event.fromReplicas || 0;
          const to = event.toReplicas || 0;
          if (to < from) {
            dayCostAfter += (from - to) * costPerReplicaHour * 24;
          } else {
            dayCostBefore += (to - from) * costPerReplicaHour * 24;
          }
        }
      }
      
      trendHistory.push({
        date: dateStr,
        before: dayCostBefore,
        after: dayCostAfter,
      });
    }

    return {
      metrics,
      totalAvoidableCost,
      primaryCostDriver,
      issues,
      trends: trendHistory,
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
      // Return empty array instead of mock data
      return [];
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
