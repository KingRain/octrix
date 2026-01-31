import { v4 as uuidv4 } from "uuid";
import { createChildLogger } from "../utils/logger.js";
import { collectNodeMetrics, collectPodMetrics } from "../metrics/index.js";
import { 
  classifyPodIncident, 
  classifyNodeIncident, 
  classifyMultiServiceFailure,
  isAutoHealable,
  shouldEscalate 
} from "./classifier.js";
import type { Incident, IncidentStatus, IncidentCategory, IncidentSeverity } from "./types.js";
import { kubernetesService } from "../services/kubernetes.service.js";

const logger = createChildLogger("incident-detector");

class IncidentDetector {
  private incidents: Map<string, Incident> = new Map();
  private detectionInterval: NodeJS.Timeout | null = null;
  private cooldowns: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 300000;
  private readonly SYSTEM_NAMESPACES = ["kube-system", "kube-public", "kube-node-lease", "monitoring"];

  getIncidents(status?: IncidentStatus): Incident[] {
    const incidents = Array.from(this.incidents.values());
    if (status) {
      return incidents.filter((i) => i.status === status);
    }
    return incidents.sort((a, b) => 
      new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );
  }

  getIncident(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  acknowledgeIncident(id: string): Incident | null {
    const incident = this.incidents.get(id);
    if (!incident) return null;

    incident.status = "acknowledged";
    incident.acknowledgedAt = new Date().toISOString();
    this.incidents.set(id, incident);
    logger.info({ incidentId: id }, "Incident acknowledged");
    return incident;
  }

  resolveIncident(id: string): Incident | null {
    const incident = this.incidents.get(id);
    if (!incident) return null;

    incident.status = "resolved";
    incident.resolvedAt = new Date().toISOString();
    this.incidents.set(id, incident);
    logger.info({ incidentId: id }, "Incident resolved");
    return incident;
  }

  markAsHealing(id: string): Incident | null {
    const incident = this.incidents.get(id);
    if (!incident) return null;

    incident.status = "healing";
    incident.autoHealingAttempted = true;
    incident.autoHealingResult = "pending";
    this.incidents.set(id, incident);
    return incident;
  }

  markHealingResult(id: string, success: boolean): Incident | null {
    const incident = this.incidents.get(id);
    if (!incident) return null;

    incident.autoHealingResult = success ? "success" : "failed";
    if (success) {
      incident.status = "resolved";
      incident.resolvedAt = new Date().toISOString();
    } else {
      incident.status = "escalated";
      incident.escalated = true;
      incident.escalatedAt = new Date().toISOString();
    }
    this.incidents.set(id, incident);
    return incident;
  }

  escalateIncident(id: string): Incident | null {
    const incident = this.incidents.get(id);
    if (!incident) return null;

    incident.status = "escalated";
    incident.escalated = true;
    incident.escalatedAt = new Date().toISOString();
    this.incidents.set(id, incident);
    logger.warn({ incidentId: id, severity: incident.severity }, "Incident escalated");
    return incident;
  }

  startDetection(intervalMs = 30000) {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
    }

    this.detectionInterval = setInterval(() => {
      this.runDetection();
    }, intervalMs);

    logger.info({ intervalMs }, "Incident detection started");
    this.runDetection();
  }

  stopDetection() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
      logger.info("Incident detection stopped");
    }
  }

  private async runDetection() {
    try {
      const [nodeMetrics, podMetrics] = await Promise.all([
        collectNodeMetrics(),
        collectPodMetrics(),
      ]);

      // Get actual pods to check for simulated labels
      const actualPods = await kubernetesService.getPods();
      const simulatedPodNames = new Set(
        actualPods
          .filter((p) => p.labels?.simulated === "true")
          .map((p) => `${p.namespace}/${p.name}`)
      );

      let failedServices = 0;

      for (const node of nodeMetrics) {
        const cooldownKey = `node:${node.nodeName}`;
        if (this.isInCooldown(cooldownKey)) continue;

        const classification = classifyNodeIncident(node);
        if (classification) {
          this.createIncident({
            title: `${classification.category.replace(/-/g, " ").toUpperCase()}: ${node.nodeName}`,
            description: classification.productionBehavior,
            severity: classification.severity,
            category: classification.category,
            resource: node.nodeName,
            resourceType: "node",
            namespace: "cluster",
            autoHealable: classification.autoHealable,
            suggestedAction: classification.suggestedAction,
            productionBehavior: classification.productionBehavior,
            metrics: {
              cpuUsage: node.cpuUsagePercent,
              memoryUsage: node.memoryUsagePercent,
              diskUsage: node.diskUsagePercent,
            },
          });
          this.setCooldown(cooldownKey);
        }
      }

      for (const pod of podMetrics) {
        // Skip system namespaces to prevent incidents for critical pods
        if (this.SYSTEM_NAMESPACES.includes(pod.namespace)) continue;
        
        const podKey = `${pod.namespace}/${pod.podName}`;
        
        // Skip simulated pods to avoid duplicate incidents
        if (simulatedPodNames.has(podKey)) continue;
        
        // Check if there's already an open incident for this pod
        const existingIncident = Array.from(this.incidents.values()).find(
          (i) => i.resource === pod.podName && 
               i.namespace === pod.namespace && 
               i.resourceType === "pod" &&
               i.status !== "resolved" &&
               i.status !== "acknowledged"
        );
        
        if (existingIncident) {
          // Update metrics on existing incident
          existingIncident.metrics = {
            cpuUsage: pod.cpuUsageCores,
            memoryUsage: pod.memoryUsageBytes,
            restartCount: pod.restartCount,
          };
          this.incidents.set(existingIncident.id, existingIncident);
          continue;
        }
        
        const cooldownKey = `pod:${podKey}`;
        if (this.isInCooldown(cooldownKey)) continue;

        const classification = classifyPodIncident(pod);
        if (classification) {
          if (pod.phase === "Failed") {
            failedServices++;
          }

          this.createIncident({
            title: `${classification.category.replace(/-/g, " ").toUpperCase()}: ${pod.podName}`,
            description: classification.productionBehavior,
            severity: classification.severity,
            category: classification.category,
            resource: pod.podName,
            resourceType: "pod",
            namespace: pod.namespace,
            autoHealable: classification.autoHealable,
            suggestedAction: classification.suggestedAction,
            productionBehavior: classification.productionBehavior,
            metrics: {
              cpuUsage: pod.cpuUsageCores,
              memoryUsage: pod.memoryUsageBytes,
              restartCount: pod.restartCount,
            },
          });
          this.setCooldown(cooldownKey);
        }
      }

      const multiServiceClassification = classifyMultiServiceFailure(failedServices);
      if (multiServiceClassification && !this.isInCooldown("multi-service")) {
        this.createIncident({
          title: "MULTI-SERVICE FAILURE: Cascading Outage Detected",
          description: multiServiceClassification.productionBehavior,
          severity: multiServiceClassification.severity,
          category: multiServiceClassification.category,
          resource: "cluster",
          resourceType: "service",
          namespace: "cluster",
          autoHealable: false,
          suggestedAction: multiServiceClassification.suggestedAction,
          productionBehavior: multiServiceClassification.productionBehavior,
          metrics: { failedServiceCount: failedServices },
        });
        this.setCooldown("multi-service");
      }
    } catch (error) {
      logger.error({ error }, "Error during incident detection");
    }
  }

  createIncident(params: {
    title: string;
    description: string;
    severity: IncidentSeverity;
    category: IncidentCategory;
    resource: string;
    resourceType: "pod" | "node" | "deployment" | "service" | "configmap";
    namespace: string;
    autoHealable: boolean;
    suggestedAction: string;
    productionBehavior: string;
    metrics: Record<string, number | string | boolean>;
  }): Incident {
    const incident: Incident = {
      id: uuidv4(),
      ...params,
      status: "open",
      detectedAt: new Date().toISOString(),
      autoHealingAttempted: false,
      escalated: false,
      relatedAlerts: [],
    };

    this.incidents.set(incident.id, incident);
    
    logger.info({
      incidentId: incident.id,
      severity: incident.severity,
      category: incident.category,
      resource: incident.resource,
      autoHealable: incident.autoHealable,
    }, "Incident detected");

    return incident;
  }

  injectSimulatedIncident(params: {
    title: string;
    description: string;
    severity: IncidentSeverity;
    category: IncidentCategory;
    resource: string;
    resourceType: "pod" | "node" | "deployment" | "service" | "configmap";
    namespace: string;
    autoHealable: boolean;
    suggestedAction: string;
    productionBehavior: string;
    metrics: Record<string, number | string | boolean>;
  }): Incident {
    const incident = this.createIncident({
      ...params,
      title: `[SIMULATED] ${params.title}`,
    });
    
    // Add simulated flag to distinguish from real incidents
    (incident as any).simulated = true;
    
    return incident;
  }

  private isInCooldown(key: string): boolean {
    const lastTime = this.cooldowns.get(key);
    if (!lastTime) return false;
    return Date.now() - lastTime < this.COOLDOWN_MS;
  }

  private setCooldown(key: string) {
    this.cooldowns.set(key, Date.now());
  }

  getStats() {
    const incidents = Array.from(this.incidents.values());
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recent = incidents.filter((i) => new Date(i.detectedAt) >= last24h);

    return {
      total: incidents.length,
      open: incidents.filter((i) => i.status === "open").length,
      acknowledged: incidents.filter((i) => i.status === "acknowledged").length,
      healing: incidents.filter((i) => i.status === "healing").length,
      escalated: incidents.filter((i) => i.status === "escalated").length,
      resolved: incidents.filter((i) => i.status === "resolved").length,
      last24h: {
        total: recent.length,
        bySeverity: {
          low: recent.filter((i) => i.severity === "low").length,
          medium: recent.filter((i) => i.severity === "medium").length,
          high: recent.filter((i) => i.severity === "high").length,
          critical: recent.filter((i) => i.severity === "critical").length,
        },
        autoHealed: recent.filter((i) => i.autoHealingResult === "success").length,
        autoHealFailed: recent.filter((i) => i.autoHealingResult === "failed").length,
        escalated: recent.filter((i) => i.escalated).length,
      },
    };
  }

  clearHistory(): void {
    this.incidents.clear();
    this.cooldowns.clear();
    logger.info("Incident history cleared");
  }
}

export const incidentDetector = new IncidentDetector();
