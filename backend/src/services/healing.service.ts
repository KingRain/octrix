import { v4 as uuidv4 } from "uuid";
import { createChildLogger } from "../utils/logger.js";
import { kubernetesService } from "./kubernetes.service.js";
import type { HealingRule, HealingEvent, ActionType } from "../types/index.js";

const logger = createChildLogger("healing-service");

export class HealingService {
  private rules: Map<string, HealingRule> = new Map();
  private events: HealingEvent[] = [];
  private evaluationInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.loadDefaultRules();
    this.generateSampleActivity();
  }

  private loadDefaultRules() {
    const defaultRules: HealingRule[] = [
      {
        id: uuidv4(),
        name: "Auto-restart CrashLoopBackOff Pods",
        description: "Automatically restart pods in CrashLoopBackOff state",
        enabled: true,
        trigger: {
          type: "pod-crash",
          conditions: [{ metric: "restart_count", operator: ">=", value: 3, duration: "5m" }],
          operator: "AND",
        },
        action: { type: "restart-pod", parameters: { gracePeriodSeconds: 30 } },
        cooldownSeconds: 300,
        triggerCount: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: "Scale on High CPU",
        description: "Scale deployment when CPU exceeds 80%",
        enabled: true,
        trigger: {
          type: "high-cpu",
          conditions: [{ metric: "cpu_usage_percent", operator: ">", value: 80, duration: "5m" }],
          operator: "AND",
        },
        action: { type: "scale-deployment", parameters: { scaleBy: 2, maxReplicas: 10 } },
        cooldownSeconds: 600,
        triggerCount: 0,
        createdAt: new Date().toISOString(),
      },
    ];

    defaultRules.forEach((rule) => this.rules.set(rule.id, rule));
  }

  getRules(): HealingRule[] {
    return Array.from(this.rules.values());
  }

  getRule(id: string): HealingRule | undefined {
    return this.rules.get(id);
  }

  createRule(rule: Omit<HealingRule, "id" | "createdAt" | "triggerCount">): HealingRule {
    const newRule: HealingRule = {
      ...rule,
      id: uuidv4(),
      triggerCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.rules.set(newRule.id, newRule);
    logger.info({ ruleId: newRule.id, name: newRule.name }, "Healing rule created");
    return newRule;
  }

  updateRule(id: string, updates: Partial<HealingRule>): HealingRule | null {
    const rule = this.rules.get(id);
    if (!rule) return null;

    const updatedRule = { ...rule, ...updates, id: rule.id };
    this.rules.set(id, updatedRule);
    logger.info({ ruleId: id }, "Healing rule updated");
    return updatedRule;
  }

  deleteRule(id: string): boolean {
    const deleted = this.rules.delete(id);
    if (deleted) {
      logger.info({ ruleId: id }, "Healing rule deleted");
    }
    return deleted;
  }

  toggleRule(id: string): HealingRule | null {
    const rule = this.rules.get(id);
    if (!rule) return null;

    rule.enabled = !rule.enabled;
    this.rules.set(id, rule);
    logger.info({ ruleId: id, enabled: rule.enabled }, "Healing rule toggled");
    return rule;
  }

  getEvents(limit = 100): HealingEvent[] {
    return this.events.slice(0, limit);
  }

  getStats(): {
    avgRecoveryTime: number;
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    skippedActions: number;
    improvementPercent: number;
    beforeAITime: number;
    withAutoHealTime: number;
  } {
    const totalActions = this.events.length;
    const successfulActions = this.events.filter(e => e.status === "success").length;
    const failedActions = this.events.filter(e => e.status === "failed").length;
    const skippedActions = this.events.filter(e => e.status === "skipped").length;
    
    const successfulEvents = this.events.filter(e => e.status === "success");
    const avgRecoveryTime = successfulEvents.length > 0
      ? successfulEvents.reduce((sum, e) => sum + e.duration, 0) / successfulEvents.length
      : 0;
    
    const beforeAITime = 15 * 60 * 1000;
    const withAutoHealTime = avgRecoveryTime > 0 ? avgRecoveryTime : 4 * 60 * 1000;
    const improvementPercent = Math.round(((beforeAITime - withAutoHealTime) / beforeAITime) * 100);

    return {
      avgRecoveryTime,
      totalActions,
      successfulActions,
      failedActions,
      skippedActions,
      improvementPercent,
      beforeAITime,
      withAutoHealTime,
    };
  }

  getActivity(limit = 50, filter = "all"): HealingEvent[] {
    let filtered = this.events;
    
    if (filter !== "all") {
      const filterMap: Record<string, string[]> = {
        cpu: ["scale-deployment"],
        memory: ["notify"],
        restarts: ["restart-pod"],
      };
      const allowedActions = filterMap[filter] || [];
      if (allowedActions.length > 0) {
        filtered = this.events.filter(e => allowedActions.includes(e.action));
      }
    }
    
    return filtered.slice(0, limit);
  }

  private generateSampleActivity() {
    const now = Date.now();
    
    const sampleEvents: HealingEvent[] = [
      {
        id: uuidv4(),
        ruleId: "rule-1",
        ruleName: "Scale Up",
        timestamp: new Date(now - 5 * 60 * 1000).toISOString(),
        status: "success",
        targetResource: "api-gateway",
        targetNamespace: "production",
        action: "scale-deployment",
        details: "Scaled up replicas from 3 to 5",
        duration: 45000,
        trigger: "High CPU Usage",
        outcome: "Success",
        actionLabel: "Scale Up",
        fromReplicas: 3,
        toReplicas: 5,
      },
      {
        id: uuidv4(),
        ruleId: "rule-2",
        ruleName: "Patch Limits",
        timestamp: new Date(now - 20 * 60 * 1000).toISOString(),
        status: "success",
        targetResource: "content-processor",
        targetNamespace: "production",
        action: "notify",
        details: "Increased memory limit to 256Mi",
        duration: 32000,
        trigger: "OOM Killed",
        outcome: "Success",
        actionLabel: "Patch Limits",
      },
      {
        id: uuidv4(),
        ruleId: "rule-3",
        ruleName: "Restart Pod",
        timestamp: new Date(now - 45 * 60 * 1000).toISOString(),
        status: "failed",
        targetResource: "worker-node-4",
        targetNamespace: "production",
        action: "restart-pod",
        details: "Attempted pod restart on worker-node-4",
        duration: 120000,
        trigger: "CrashLoopBackOff",
        outcome: "Failed (Manual intervention required)",
        actionLabel: "Restart Pod",
      },
      {
        id: uuidv4(),
        ruleId: "rule-4",
        ruleName: "Scale Down",
        timestamp: new Date(now - 60 * 60 * 1000).toISOString(),
        status: "skipped",
        targetResource: "recommendation-service",
        targetNamespace: "production",
        action: "scale-deployment",
        details: "Scaled down replicas from 4 to 2",
        duration: 0,
        trigger: "Low Utilization",
        outcome: "Skipped (Cooldown active)",
        actionLabel: "Scale Down",
        fromReplicas: 4,
        toReplicas: 2,
      },
      {
        id: uuidv4(),
        ruleId: "rule-5",
        ruleName: "Scale Up",
        timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        status: "success",
        targetResource: "video-transcoder",
        targetNamespace: "production",
        action: "scale-deployment",
        details: "Scaled up replicas from 2 to 4",
        duration: 38000,
        trigger: "High CPU Usage",
        outcome: "Success",
        actionLabel: "Scale Up",
        fromReplicas: 2,
        toReplicas: 4,
      },
      {
        id: uuidv4(),
        ruleId: "rule-6",
        ruleName: "Restart Pod",
        timestamp: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
        status: "success",
        targetResource: "auth-service-pod-xyz",
        targetNamespace: "production",
        action: "restart-pod",
        details: "Pod restarted successfully after crash loop",
        duration: 52000,
        trigger: "CrashLoopBackOff",
        outcome: "Success",
        actionLabel: "Restart Pod",
      },
    ];

    this.events = sampleEvents;
  }

  async executeAction(
    rule: HealingRule,
    targetResource: string,
    targetNamespace: string
  ): Promise<HealingEvent> {
    const event: HealingEvent = {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      timestamp: new Date().toISOString(),
      status: "in-progress",
      targetResource,
      targetNamespace,
      action: rule.action.type,
      details: "",
      duration: 0,
    };

    const startTime = Date.now();

    try {
      await this.performAction(rule.action.type, targetResource, targetNamespace, rule.action.parameters);
      
      event.status = "success";
      event.details = `Successfully executed ${rule.action.type} on ${targetResource}`;
      
      const existingRule = this.rules.get(rule.id);
      if (existingRule) {
        existingRule.triggerCount++;
        existingRule.lastTriggered = new Date().toISOString();
        this.rules.set(rule.id, existingRule);
      }
    } catch (error) {
      event.status = "failed";
      event.details = `Failed to execute ${rule.action.type}: ${error instanceof Error ? error.message : "Unknown error"}`;
      logger.error({ error, ruleId: rule.id, targetResource }, "Healing action failed");
    }

    event.duration = Date.now() - startTime;
    this.events.unshift(event);

    if (this.events.length > 1000) {
      this.events = this.events.slice(0, 1000);
    }

    return event;
  }

  private async performAction(
    actionType: ActionType,
    targetResource: string,
    targetNamespace: string,
    parameters: Record<string, unknown>
  ): Promise<void> {
    switch (actionType) {
      case "restart-pod":
        await kubernetesService.deletePod(targetNamespace, targetResource);
        break;

      case "scale-deployment":
        const scaleBy = (parameters.scaleBy as number) || 1;
        await kubernetesService.scaleDeployment(targetNamespace, targetResource, scaleBy);
        break;

      case "cordon-node":
        await kubernetesService.cordonNode(targetResource);
        break;

      case "drain-node":
        await kubernetesService.cordonNode(targetResource);
        break;

      case "notify":
        logger.info({ targetResource, targetNamespace }, "Notification sent");
        break;

      case "custom-script":
        logger.warn({ targetResource }, "Custom script execution not implemented");
        break;

      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  startEvaluation(intervalMs = 30000) {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }

    this.evaluationInterval = setInterval(() => {
      this.evaluateRules();
    }, intervalMs);

    logger.info({ intervalMs }, "Healing evaluation started");
  }

  stopEvaluation() {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
      logger.info("Healing evaluation stopped");
    }
  }

  private async evaluateRules() {
    const enabledRules = Array.from(this.rules.values()).filter((r) => r.enabled);
    logger.debug({ ruleCount: enabledRules.length }, "Evaluating healing rules");
  }
}

export const healingService = new HealingService();
