import { v4 as uuidv4 } from "uuid";
import { createChildLogger } from "../utils/logger.js";
import type { IncidentCategory } from "../incidents/types.js";
import type { HealingActionType } from "./actions.js";

const logger = createChildLogger("healing-rules");

export interface HealingRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  targetCategory: IncidentCategory;
  actionType: HealingActionType;
  parameters: Record<string, unknown>;
  cooldownSeconds: number;
  maxRetries: number;
  triggerCount: number;
  lastTriggered?: string;
  createdAt: string;
}

export interface HealingEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  incidentId: string;
  timestamp: string;
  status: "success" | "failed" | "in-progress";
  targetResource: string;
  targetNamespace: string;
  action: HealingActionType;
  details: string;
  duration: number;
}

class HealingRulesManager {
  private rules: Map<string, HealingRule> = new Map();
  private events: HealingEvent[] = [];

  constructor() {
    this.loadDefaultRules();
    // Removed sample events loading to show only real data
  }

  private loadDefaultRules() {
    const defaultRules: Omit<HealingRule, "id" | "createdAt" | "triggerCount">[] = [
      {
        name: "Auto-restart OOMKilled Pods",
        description: "Patch memory limit and restart pods killed due to OOM",
        enabled: true,
        targetCategory: "oom-killed",
        actionType: "patch-memory",
        parameters: { memoryIncreaseFactor: 1.5, restartAfterPatch: true },
        cooldownSeconds: 300,
        maxRetries: 3,
      },
      {
        name: "Scale on High CPU",
        description: "Scale deployment when CPU exceeds threshold",
        enabled: true,
        targetCategory: "high-cpu",
        actionType: "scale-deployment",
        parameters: { scaleBy: 1, maxReplicas: 10 },
        cooldownSeconds: 600,
        maxRetries: 2,
      },
      {
        name: "Restart CrashLoop Pods",
        description: "Restart pods in CrashLoopBackOff with backoff",
        enabled: true,
        targetCategory: "crash-loop",
        actionType: "restart-pod",
        parameters: { gracePeriodSeconds: 30, backoffMultiplier: 2 },
        cooldownSeconds: 300,
        maxRetries: 5,
      },
      {
        name: "Fix CPU Throttling",
        description: "Increase CPU limit for throttled pods",
        enabled: true,
        targetCategory: "pod-throttling",
        actionType: "patch-cpu",
        parameters: { cpuIncreaseFactor: 1.5 },
        cooldownSeconds: 600,
        maxRetries: 2,
      },
      {
        name: "Scale Down Underutilized",
        description: "Scale down deployments with low resource usage",
        enabled: true,
        targetCategory: "underutilization",
        actionType: "scale-deployment",
        parameters: { scaleBy: -1, minReplicas: 1 },
        cooldownSeconds: 900,
        maxRetries: 1,
      },
      {
        name: "Retry Image Pull",
        description: "Retry failed image pulls with backoff",
        enabled: true,
        targetCategory: "image-pull-delay",
        actionType: "retry-image-pull",
        parameters: { maxRetries: 3, backoffSeconds: 30 },
        cooldownSeconds: 120,
        maxRetries: 3,
      },
    ];

    defaultRules.forEach((rule) => {
      const fullRule: HealingRule = {
        ...rule,
        id: uuidv4(),
        triggerCount: 0,
        createdAt: new Date().toISOString(),
      };
      this.rules.set(fullRule.id, fullRule);
    });
  }

  getRules(): HealingRule[] {
    return Array.from(this.rules.values());
  }

  getRule(id: string): HealingRule | undefined {
    return this.rules.get(id);
  }

  getRuleForCategory(category: IncidentCategory): HealingRule | undefined {
    return Array.from(this.rules.values()).find(
      (rule) => rule.enabled && rule.targetCategory === category
    );
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

  recordEvent(event: Omit<HealingEvent, "id" | "timestamp">): HealingEvent {
    const fullEvent: HealingEvent = {
      ...event,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };
    this.events.unshift(fullEvent);

    if (this.events.length > 1000) {
      this.events = this.events.slice(0, 1000);
    }

    const rule = this.rules.get(event.ruleId);
    if (rule) {
      rule.triggerCount++;
      rule.lastTriggered = fullEvent.timestamp;
      this.rules.set(rule.id, rule);
    }

    return fullEvent;
  }

  getEvents(limit = 100): HealingEvent[] {
    return this.events.slice(0, limit);
  }

  clearEvents(): void {
    this.events = [];
    logger.info("Healing events cleared");
  }

  getEventsByRule(ruleId: string, limit = 50): HealingEvent[] {
    return this.events.filter((e) => e.ruleId === ruleId).slice(0, limit);
  }

  private loadSampleEvents() {
    const now = Date.now();
    const rules = this.getRules();
    
    const sampleEvents: HealingEvent[] = [
      {
        id: uuidv4(),
        ruleId: rules[1]?.id || "rule-1",
        ruleName: "Scale on High CPU",
        incidentId: "inc-1",
        timestamp: new Date(now - 5 * 60 * 1000).toISOString(),
        status: "success",
        targetResource: "api-gateway",
        targetNamespace: "production",
        action: "scale-deployment",
        details: "Scaled up replicas from 3 to 5",
        duration: 45000,
      },
      {
        id: uuidv4(),
        ruleId: rules[0]?.id || "rule-2",
        ruleName: "Auto-restart OOMKilled Pods",
        incidentId: "inc-2",
        timestamp: new Date(now - 20 * 60 * 1000).toISOString(),
        status: "success",
        targetResource: "content-processor",
        targetNamespace: "production",
        action: "patch-memory",
        details: "Increased memory limit to 256Mi",
        duration: 32000,
      },
      {
        id: uuidv4(),
        ruleId: rules[2]?.id || "rule-3",
        ruleName: "Restart CrashLoop Pods",
        incidentId: "inc-3",
        timestamp: new Date(now - 45 * 60 * 1000).toISOString(),
        status: "failed",
        targetResource: "worker-node-4",
        targetNamespace: "production",
        action: "restart-pod",
        details: "Attempted pod restart on worker-node-4",
        duration: 120000,
      },
      {
        id: uuidv4(),
        ruleId: rules[4]?.id || "rule-4",
        ruleName: "Scale Down Underutilized",
        incidentId: "inc-4",
        timestamp: new Date(now - 60 * 60 * 1000).toISOString(),
        status: "in-progress",
        targetResource: "recommendation-service",
        targetNamespace: "production",
        action: "scale-deployment",
        details: "Scaled down replicas from 4 to 2",
        duration: 0,
      },
      {
        id: uuidv4(),
        ruleId: rules[1]?.id || "rule-5",
        ruleName: "Scale on High CPU",
        incidentId: "inc-5",
        timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        status: "success",
        targetResource: "video-transcoder",
        targetNamespace: "production",
        action: "scale-deployment",
        details: "Scaled up replicas from 2 to 4",
        duration: 38000,
      },
      {
        id: uuidv4(),
        ruleId: rules[2]?.id || "rule-6",
        ruleName: "Restart CrashLoop Pods",
        incidentId: "inc-6",
        timestamp: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
        status: "success",
        targetResource: "auth-service-pod-xyz",
        targetNamespace: "production",
        action: "restart-pod",
        details: "Pod restarted successfully after crash loop",
        duration: 52000,
      },
    ];

    this.events = sampleEvents;
  }
}

export const healingRulesManager = new HealingRulesManager();
