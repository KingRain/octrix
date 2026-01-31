import { createChildLogger } from "../utils/logger.js";
import { incidentDetector } from "../incidents/detector.js";
import { healingRulesManager, type HealingEvent } from "./rules.js";
import { getHealingActionForCategory, isActionAutomatic, type HealingResult } from "./actions.js";
import type { Incident } from "../incidents/types.js";

const logger = createChildLogger("healing-engine");

class HealingEngine {
  private evaluationInterval: NodeJS.Timeout | null = null;
  private processingIncidents: Set<string> = new Set();
  private _enabled: boolean = true;

  get enabled(): boolean {
    return this._enabled;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    logger.info({ enabled }, "Healing engine enabled state changed");
  }

  startEvaluation(intervalMs = 15000) {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }

    this.evaluationInterval = setInterval(() => {
      this.evaluateAndHeal();
    }, intervalMs);

    logger.info({ intervalMs }, "Healing engine started");
  }

  stopEvaluation() {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
      logger.info("Healing engine stopped");
    }
  }

  private async evaluateAndHeal() {
    if (!this._enabled) {
      return;
    }

    const openIncidents = incidentDetector.getIncidents("open");
    
    for (const incident of openIncidents) {
      if (this.processingIncidents.has(incident.id)) continue;
      
      if (incident.autoHealable) {
        await this.attemptAutoHealing(incident);
      } else {
        this.escalateIncident(incident);
      }
    }
  }

  private async attemptAutoHealing(incident: Incident) {
    this.processingIncidents.add(incident.id);
    
    try {
      const rule = healingRulesManager.getRuleForCategory(incident.category);
      
      if (!rule) {
        logger.warn({ incidentId: incident.id, category: incident.category }, "No healing rule found");
        this.escalateIncident(incident);
        return;
      }

      const action = getHealingActionForCategory(incident.category);
      
      if (!isActionAutomatic(action.type)) {
        logger.info({ incidentId: incident.id, action: action.type }, "Action requires manual approval");
        this.escalateIncident(incident);
        return;
      }

      incidentDetector.markAsHealing(incident.id);
      
      logger.info({
        incidentId: incident.id,
        ruleId: rule.id,
        action: action.type,
        resource: incident.resource,
      }, "Attempting auto-healing");

      const startTime = Date.now();
      const result = await this.executeHealingAction(incident, rule, action);
      const duration = Date.now() - startTime;

      const event: Omit<HealingEvent, "id" | "timestamp"> = {
        ruleId: rule.id,
        ruleName: rule.name,
        incidentId: incident.id,
        status: result.success ? "success" : "failed",
        targetResource: incident.resource,
        targetNamespace: incident.namespace,
        action: action.type,
        details: result.message,
        duration,
      };

      healingRulesManager.recordEvent(event);
      incidentDetector.markHealingResult(incident.id, result.success);

      if (result.success) {
        logger.info({
          incidentId: incident.id,
          action: action.type,
          duration,
        }, "Auto-healing successful");
      } else {
        logger.warn({
          incidentId: incident.id,
          action: action.type,
          error: result.message,
        }, "Auto-healing failed, escalating");
      }
    } catch (error) {
      logger.error({ error, incidentId: incident.id }, "Error during auto-healing");
      incidentDetector.markHealingResult(incident.id, false);
    } finally {
      this.processingIncidents.delete(incident.id);
    }
  }

  private async executeHealingAction(
    incident: Incident,
    rule: { parameters: Record<string, unknown> },
    action: { type: string; parameters: Record<string, unknown> }
  ): Promise<HealingResult> {
    const startTime = Date.now();

    try {
      switch (action.type) {
        case "restart-pod":
          return await this.restartPod(incident, rule.parameters);
        
        case "scale-deployment":
          return await this.scaleDeployment(incident, rule.parameters);
        
        case "patch-memory":
          return await this.patchMemory(incident, rule.parameters);
        
        case "patch-cpu":
          return await this.patchCpu(incident, rule.parameters);
        
        case "retry-image-pull":
          return await this.retryImagePull(incident, rule.parameters);
        
        case "no-action":
          return {
            success: true,
            action: "no-action",
            message: "No action required - Kubernetes will handle automatically",
            duration: Date.now() - startTime,
          };
        
        default:
          return {
            success: false,
            action: action.type as HealingResult["action"],
            message: `Unknown action type: ${action.type}`,
            duration: Date.now() - startTime,
          };
      }
    } catch (error) {
      return {
        success: false,
        action: action.type as HealingResult["action"],
        message: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime,
      };
    }
  }

  private async restartPod(
    incident: Incident,
    params: Record<string, unknown>
  ): Promise<HealingResult> {
    const gracePeriod = (params.gracePeriodSeconds as number) || 30;
    
    logger.info({
      pod: incident.resource,
      namespace: incident.namespace,
      gracePeriod,
    }, "Restarting pod");

    await this.simulateK8sOperation(500);

    return {
      success: true,
      action: "restart-pod",
      message: `Pod ${incident.resource} restarted with ${gracePeriod}s grace period`,
      duration: 0,
      details: { gracePeriod },
    };
  }

  private async scaleDeployment(
    incident: Incident,
    params: Record<string, unknown>
  ): Promise<HealingResult> {
    const scaleBy = (params.scaleBy as number) || 1;
    const maxReplicas = (params.maxReplicas as number) || 10;
    const minReplicas = (params.minReplicas as number) || 1;

    logger.info({
      resource: incident.resource,
      namespace: incident.namespace,
      scaleBy,
    }, "Scaling deployment");

    await this.simulateK8sOperation(800);

    const direction = scaleBy > 0 ? "up" : "down";
    return {
      success: true,
      action: "scale-deployment",
      message: `Deployment scaled ${direction} by ${Math.abs(scaleBy)} replicas`,
      duration: 0,
      details: { scaleBy, maxReplicas, minReplicas },
    };
  }

  private async patchMemory(
    incident: Incident,
    params: Record<string, unknown>
  ): Promise<HealingResult> {
    const increaseFactor = (params.memoryIncreaseFactor as number) || 1.5;
    const restartAfter = (params.restartAfterPatch as boolean) ?? true;

    logger.info({
      pod: incident.resource,
      namespace: incident.namespace,
      increaseFactor,
    }, "Patching memory limit");

    await this.simulateK8sOperation(600);

    return {
      success: true,
      action: "patch-memory",
      message: `Memory limit increased by ${(increaseFactor - 1) * 100}%${restartAfter ? " and pod restarted" : ""}`,
      duration: 0,
      details: { increaseFactor, restartAfter },
    };
  }

  private async patchCpu(
    incident: Incident,
    params: Record<string, unknown>
  ): Promise<HealingResult> {
    const increaseFactor = (params.cpuIncreaseFactor as number) || 1.5;

    logger.info({
      pod: incident.resource,
      namespace: incident.namespace,
      increaseFactor,
    }, "Patching CPU limit");

    await this.simulateK8sOperation(600);

    return {
      success: true,
      action: "patch-cpu",
      message: `CPU limit increased by ${(increaseFactor - 1) * 100}%`,
      duration: 0,
      details: { increaseFactor },
    };
  }

  private async retryImagePull(
    incident: Incident,
    params: Record<string, unknown>
  ): Promise<HealingResult> {
    const maxRetries = (params.maxRetries as number) || 3;
    const backoffSeconds = (params.backoffSeconds as number) || 30;

    logger.info({
      pod: incident.resource,
      namespace: incident.namespace,
      maxRetries,
    }, "Retrying image pull");

    await this.simulateK8sOperation(1000);

    return {
      success: true,
      action: "retry-image-pull",
      message: `Image pull retried (max ${maxRetries} attempts with ${backoffSeconds}s backoff)`,
      duration: 0,
      details: { maxRetries, backoffSeconds },
    };
  }

  private escalateIncident(incident: Incident) {
    incidentDetector.escalateIncident(incident.id);
    
    logger.warn({
      incidentId: incident.id,
      severity: incident.severity,
      category: incident.category,
      resource: incident.resource,
    }, "Incident escalated - requires manual intervention");
  }

  private simulateK8sOperation(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  async manualHeal(incidentId: string): Promise<HealingResult> {
    const incident = incidentDetector.getIncident(incidentId);
    if (!incident) {
      return {
        success: false,
        action: "no-action",
        message: "Incident not found",
        duration: 0,
      };
    }

    const rule = healingRulesManager.getRuleForCategory(incident.category);
    if (!rule) {
      return {
        success: false,
        action: "no-action",
        message: "No healing rule configured for this incident type",
        duration: 0,
      };
    }

    const action = getHealingActionForCategory(incident.category);
    incidentDetector.markAsHealing(incident.id);
    
    const result = await this.executeHealingAction(incident, rule, action);
    incidentDetector.markHealingResult(incident.id, result.success);
    
    return result;
  }
}

export const healingEngine = new HealingEngine();
