import { createChildLogger } from "../utils/logger.js";
import type { IncidentCategory } from "../incidents/types.js";

const logger = createChildLogger("healing-actions");

export type HealingActionType = 
  | "restart-pod"
  | "scale-deployment"
  | "patch-memory"
  | "patch-cpu"
  | "cordon-node"
  | "uncordon-node"
  | "drain-node"
  | "retry-image-pull"
  | "rollback-deployment"
  | "notify"
  | "no-action";

export interface HealingAction {
  type: HealingActionType;
  description: string;
  parameters: Record<string, unknown>;
}

export interface HealingResult {
  success: boolean;
  action: HealingActionType;
  message: string;
  duration: number;
  details?: Record<string, unknown>;
}

export function getHealingActionForCategory(category: IncidentCategory): HealingAction {
  const actionMap: Record<IncidentCategory, HealingAction> = {
    "oom-killed": {
      type: "patch-memory",
      description: "Increase memory limit and restart pod",
      parameters: { memoryIncreaseFactor: 1.5, restartAfterPatch: true },
    },
    "high-cpu": {
      type: "scale-deployment",
      description: "Scale deployment horizontally",
      parameters: { scaleBy: 1, maxReplicas: 10 },
    },
    "crash-loop": {
      type: "restart-pod",
      description: "Restart pod with exponential backoff",
      parameters: { gracePeriodSeconds: 30, backoffMultiplier: 2 },
    },
    "pod-throttling": {
      type: "patch-cpu",
      description: "Increase CPU limit",
      parameters: { cpuIncreaseFactor: 1.5 },
    },
    "underutilization": {
      type: "scale-deployment",
      description: "Scale down deployment",
      parameters: { scaleBy: -1, minReplicas: 1 },
    },
    "node-eviction": {
      type: "no-action",
      description: "Allow Kubernetes scheduler to handle rescheduling",
      parameters: {},
    },
    "image-pull-delay": {
      type: "retry-image-pull",
      description: "Retry image pull with backoff",
      parameters: { maxRetries: 3, backoffSeconds: 30 },
    },
    "buggy-deployment": {
      type: "rollback-deployment",
      description: "Rollback to previous stable version",
      parameters: { notifyDevs: true },
    },
    "configmap-error": {
      type: "notify",
      description: "Alert ops team - manual intervention required",
      parameters: { severity: "high", freezeAutomation: true },
    },
    "db-failure": {
      type: "notify",
      description: "Alert DBA and on-call - critical service down",
      parameters: { severity: "critical", freezeHealing: true, pageDBA: true },
    },
    "unknown-crash": {
      type: "notify",
      description: "Escalate with full diagnostics",
      parameters: { collectDiagnostics: true, severity: "high" },
    },
    "multi-service-failure": {
      type: "notify",
      description: "Raise critical incident, page on-call team",
      parameters: { severity: "critical", pageOnCall: true, freezeAll: true },
    },
    "node-not-ready": {
      type: "notify",
      description: "Investigate node health - manual intervention required",
      parameters: { severity: "critical", checkKubelet: true },
    },
    "node-pressure": {
      type: "cordon-node",
      description: "Cordon node to prevent new pod scheduling",
      parameters: { evictLowPriority: true },
    },
  };

  return actionMap[category] || {
    type: "notify",
    description: "Unknown incident type - escalate for review",
    parameters: { severity: "medium" },
  };
}

export function isActionAutomatic(actionType: HealingActionType): boolean {
  const automaticActions: HealingActionType[] = [
    "restart-pod",
    "scale-deployment",
    "patch-memory",
    "patch-cpu",
    "retry-image-pull",
    "no-action",
  ];
  return automaticActions.includes(actionType);
}

export function requiresApproval(actionType: HealingActionType): boolean {
  const approvalRequired: HealingActionType[] = [
    "cordon-node",
    "drain-node",
    "rollback-deployment",
  ];
  return approvalRequired.includes(actionType);
}
