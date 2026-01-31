import { createChildLogger } from "../utils/logger.js";
import type { 
  Incident, 
  IncidentSeverity, 
  IncidentCategory,
  IncidentScenario,
  AUTO_HEALABLE_SCENARIOS,
  ESCALATED_SCENARIOS 
} from "./types.js";
import type { PodMetrics } from "../metrics/pod.metrics.js";
import type { NodeMetrics } from "../metrics/node.metrics.js";

const logger = createChildLogger("incident-classifier");

interface ClassificationResult {
  category: IncidentCategory;
  severity: IncidentSeverity;
  autoHealable: boolean;
  suggestedAction: string;
  productionBehavior: string;
}

export function classifyPodIncident(pod: PodMetrics): ClassificationResult | null {
  // Skip creating incidents for low-severity issues (normal operational issues)
  // Only create incidents for high or critical severity issues
  const severity = determineSeverity(pod);
  if (severity === "low") {
    return null;
  }

  if (pod.oomKilled) {
    return {
      category: "oom-killed",
      severity: "medium",
      autoHealable: true,
      suggestedAction: "Patch memory limit & restart pod",
      productionBehavior: "Pod crashes due to memory exhaustion",
    };
  }

  if (pod.cpuUsageCores > 0 && pod.cpuLimitCores > 0) {
    const cpuPercent = (pod.cpuUsageCores / pod.cpuLimitCores) * 100;
    if (cpuPercent > 80) {
      return {
        category: "high-cpu",
        severity: "medium",
        autoHealable: true,
        suggestedAction: "Scale replicas horizontally",
        productionBehavior: "Latency spikes, slow response times",
      };
    }
  }

  if (pod.restartCount >= 50) {
    return {
      category: "unknown-crash",
      severity: "high",
      autoHealable: false,
      suggestedAction: "Escalate with full diagnostics",
      productionBehavior: "Non-standard failure pattern",
    };
  }

  if (pod.restartCount >= 5) {
    return {
      category: "crash-loop",
      severity: "medium",
      autoHealable: true,
      suggestedAction: "Check logs, fix root cause, restart pod",
      productionBehavior: "Pod repeatedly crashing and restarting",
    };
  }

  if (pod.phase === "Failed") {
    return {
      category: "unknown-crash",
      severity: "high",
      autoHealable: false,
      suggestedAction: "Escalate with full diagnostics",
      productionBehavior: "Pod failed to start",
    };
  }

  return null;
}

function determineSeverity(pod: PodMetrics): "low" | "medium" | "high" | "critical" {
  if (pod.oomKilled) return "medium";
  if (pod.cpuUsageCores > 0 && pod.cpuLimitCores > 0) {
    const cpuPercent = (pod.cpuUsageCores / pod.cpuLimitCores) * 100;
    if (cpuPercent > 90) return "critical";
    if (cpuPercent > 80) return "medium";
  }
  if (pod.restartCount >= 10) return "high";
  if (pod.phase === "Failed") return "high";
  return "low";
}

export function classifyNodeIncident(node: NodeMetrics): ClassificationResult | null {
  if (!node.conditions.ready) {
    return {
      category: "node-not-ready",
      severity: "critical",
      autoHealable: false,
      suggestedAction: "Investigate node health, check kubelet",
      productionBehavior: "Node unavailable, pods rescheduling",
    };
  }

  if (node.conditions.memoryPressure || node.conditions.diskPressure) {
    return {
      category: "node-pressure",
      severity: "high",
      autoHealable: false,
      suggestedAction: "Cordon node, investigate resource usage",
      productionBehavior: "Node under pressure, evictions possible",
    };
  }

  if (node.cpuUsagePercent > 90) {
    return {
      category: "high-cpu",
      severity: "medium",
      autoHealable: true,
      suggestedAction: "Redistribute workloads or add capacity",
      productionBehavior: "Node CPU saturated",
    };
  }

  if (node.memoryUsagePercent > 90) {
    return {
      category: "node-pressure",
      severity: "high",
      autoHealable: false,
      suggestedAction: "Cordon node, evict low-priority pods",
      productionBehavior: "Memory pressure, OOM risk",
    };
  }

  return null;
}

export function classifyDeploymentIncident(
  errorRate: number,
  hasConfigError: boolean,
  hasDbError: boolean
): ClassificationResult | null {
  if (hasDbError) {
    return {
      category: "db-failure",
      severity: "critical",
      autoHealable: false,
      suggestedAction: "Freeze healing, alert DBA and on-call",
      productionBehavior: "Service completely down",
    };
  }

  if (hasConfigError) {
    return {
      category: "configmap-error",
      severity: "high",
      autoHealable: false,
      suggestedAction: "Stop automation, alert ops team",
      productionBehavior: "App crash due to missing config",
    };
  }

  if (errorRate > 10) {
    return {
      category: "buggy-deployment",
      severity: "high",
      autoHealable: false,
      suggestedAction: "Alert developers, freeze deployments",
      productionBehavior: "5xx errors, service degradation",
    };
  }

  return null;
}

export function classifyMultiServiceFailure(failedServiceCount: number): ClassificationResult | null {
  if (failedServiceCount >= 3) {
    return {
      category: "multi-service-failure",
      severity: "critical",
      autoHealable: false,
      suggestedAction: "Raise critical incident, page on-call",
      productionBehavior: "Cascading outage across services",
    };
  }
  return null;
}

export function isAutoHealable(category: IncidentCategory): boolean {
  const autoHealableCategories: IncidentCategory[] = [
    "oom-killed",
    "high-cpu",
    "crash-loop",
    "pod-throttling",
    "underutilization",
    "node-eviction",
    "image-pull-delay",
  ];
  return autoHealableCategories.includes(category);
}

export function shouldEscalate(severity: IncidentSeverity, category: IncidentCategory): boolean {
  if (severity === "critical" || severity === "high") {
    return true;
  }
  
  const alwaysEscalate: IncidentCategory[] = [
    "buggy-deployment",
    "configmap-error",
    "db-failure",
    "unknown-crash",
    "multi-service-failure",
  ];
  
  return alwaysEscalate.includes(category);
}

export function getSeverityPriority(severity: IncidentSeverity): number {
  const priorities: Record<IncidentSeverity, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return priorities[severity];
}
