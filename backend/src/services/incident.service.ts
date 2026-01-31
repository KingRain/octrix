import { v4 as uuidv4 } from "uuid";
import { createChildLogger } from "../utils/logger.js";
import { prometheusService, type PodMetrics, type NodeMetrics } from "./prometheus.service.js";
import { kubernetesService } from "./kubernetes.service.js";
import { healingService } from "./healing.service.js";
import { emitAlert, emitHealingEvent } from "../server.js";
import type { Alert, AlertSeverity } from "../types/index.js";

const logger = createChildLogger("incident-service");

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  category: IncidentCategory;
  status: IncidentStatus;
  resource: string;
  resourceType: "pod" | "node" | "deployment" | "service";
  namespace: string;
  detectedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  autoHealingAttempted: boolean;
  autoHealingResult?: "success" | "failed" | "pending";
  escalated: boolean;
  escalatedAt?: string;
  metrics: Record<string, number>;
  relatedAlerts: string[];
}

export type IncidentCategory =
  | "pod-crash"
  | "high-cpu"
  | "high-memory"
  | "oom-killed"
  | "node-pressure"
  | "node-not-ready"
  | "deployment-unavailable"
  | "service-endpoint-missing"
  | "persistent-restarts"
  | "resource-quota-exceeded";

export type IncidentStatus = "open" | "acknowledged" | "healing" | "escalated" | "resolved";

interface SeverityThresholds {
  cpuWarning: number;
  cpuCritical: number;
  memoryWarning: number;
  memoryCritical: number;
  restartWarning: number;
  restartCritical: number;
  diskWarning: number;
  diskCritical: number;
}

const DEFAULT_THRESHOLDS: SeverityThresholds = {
  cpuWarning: 70,
  cpuCritical: 90,
  memoryWarning: 75,
  memoryCritical: 95,
  restartWarning: 3,
  restartCritical: 10,
  diskWarning: 80,
  diskCritical: 95,
};

export class IncidentService {
  private incidents: Map<string, Incident> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private detectionInterval: NodeJS.Timeout | null = null;
  private thresholds: SeverityThresholds = DEFAULT_THRESHOLDS;
  private incidentCooldowns: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 300000;

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

  getAlerts(acknowledged?: boolean): Alert[] {
    const alerts = Array.from(this.alerts.values());
    if (acknowledged !== undefined) {
      return alerts.filter((a) => a.acknowledged === acknowledged);
    }
    return alerts.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
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

  acknowledgeAlert(id: string): Alert | null {
    const alert = this.alerts.get(id);
    if (!alert) return null;

    alert.acknowledged = true;
    this.alerts.set(id, alert);
    
    logger.info({ alertId: id }, "Alert acknowledged");
    return alert;
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

  clearHistory(): void {
    this.incidents.clear();
    this.alerts.clear();
    this.incidentCooldowns.clear();
    logger.info("Incident history cleared");
  }

  startDetection(intervalMs = 30000) {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
    }

    this.detectionInterval = setInterval(() => {
      this.detectIncidents();
    }, intervalMs);

    logger.info({ intervalMs }, "Incident detection started");
    this.detectIncidents();
  }

  stopDetection() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
      logger.info("Incident detection stopped");
    }
  }

  private async detectIncidents() {
    try {
      const [nodeMetrics, podMetrics, pods] = await Promise.all([
        prometheusService.getNodeMetrics(),
        prometheusService.getPodMetrics(),
        kubernetesService.getPods().catch(() => []),
      ]);

      await this.detectNodeIncidents(nodeMetrics);
      await this.detectPodIncidents(podMetrics, pods);
      await this.processAutoHealing();
    } catch (error) {
      logger.error({ error }, "Error during incident detection");
    }
  }

  private async detectNodeIncidents(nodeMetrics: NodeMetrics[]) {
    for (const node of nodeMetrics) {
      const cooldownKey = `node:${node.nodeName}`;
      if (this.isInCooldown(cooldownKey)) continue;

      if (!node.conditions.ready) {
        this.createIncident({
          title: `Node ${node.nodeName} Not Ready`,
          description: `Node ${node.nodeName} is in NotReady state`,
          severity: "critical",
          category: "node-not-ready",
          resource: node.nodeName,
          resourceType: "node",
          namespace: "cluster",
          metrics: {
            cpuUsage: node.cpuUsagePercent,
            memoryUsage: node.memoryUsagePercent,
          },
        });
        this.setCooldown(cooldownKey);
        continue;
      }

      if (node.conditions.memoryPressure) {
        this.createIncident({
          title: `Memory Pressure on ${node.nodeName}`,
          description: `Node ${node.nodeName} is experiencing memory pressure`,
          severity: "high",
          category: "node-pressure",
          resource: node.nodeName,
          resourceType: "node",
          namespace: "cluster",
          metrics: { memoryUsage: node.memoryUsagePercent },
        });
        this.setCooldown(cooldownKey);
      }

      if (node.conditions.diskPressure) {
        this.createIncident({
          title: `Disk Pressure on ${node.nodeName}`,
          description: `Node ${node.nodeName} is experiencing disk pressure`,
          severity: "high",
          category: "node-pressure",
          resource: node.nodeName,
          resourceType: "node",
          namespace: "cluster",
          metrics: { diskUsage: node.diskUsagePercent },
        });
        this.setCooldown(cooldownKey);
      }

      if (node.cpuUsagePercent >= this.thresholds.cpuCritical) {
        this.createIncident({
          title: `Critical CPU Usage on ${node.nodeName}`,
          description: `Node CPU usage at ${node.cpuUsagePercent.toFixed(1)}%`,
          severity: "critical",
          category: "high-cpu",
          resource: node.nodeName,
          resourceType: "node",
          namespace: "cluster",
          metrics: { cpuUsage: node.cpuUsagePercent },
        });
        this.setCooldown(cooldownKey);
      } else if (node.cpuUsagePercent >= this.thresholds.cpuWarning) {
        this.createIncident({
          title: `High CPU Usage on ${node.nodeName}`,
          description: `Node CPU usage at ${node.cpuUsagePercent.toFixed(1)}%`,
          severity: "medium",
          category: "high-cpu",
          resource: node.nodeName,
          resourceType: "node",
          namespace: "cluster",
          metrics: { cpuUsage: node.cpuUsagePercent },
        });
        this.setCooldown(cooldownKey);
      }

      if (node.memoryUsagePercent >= this.thresholds.memoryCritical) {
        this.createIncident({
          title: `Critical Memory Usage on ${node.nodeName}`,
          description: `Node memory usage at ${node.memoryUsagePercent.toFixed(1)}%`,
          severity: "critical",
          category: "high-memory",
          resource: node.nodeName,
          resourceType: "node",
          namespace: "cluster",
          metrics: { memoryUsage: node.memoryUsagePercent },
        });
        this.setCooldown(cooldownKey);
      } else if (node.memoryUsagePercent >= this.thresholds.memoryWarning) {
        this.createIncident({
          title: `High Memory Usage on ${node.nodeName}`,
          description: `Node memory usage at ${node.memoryUsagePercent.toFixed(1)}%`,
          severity: "medium",
          category: "high-memory",
          resource: node.nodeName,
          resourceType: "node",
          namespace: "cluster",
          metrics: { memoryUsage: node.memoryUsagePercent },
        });
        this.setCooldown(cooldownKey);
      }
    }
  }

  private async detectPodIncidents(podMetrics: PodMetrics[], pods: Array<{ name: string; namespace: string; status: string; restarts: number }>) {
    const podMap = new Map(pods.map((p) => [`${p.namespace}/${p.name}`, p]));

    for (const metrics of podMetrics) {
      const cooldownKey = `pod:${metrics.namespace}/${metrics.podName}`;
      if (this.isInCooldown(cooldownKey)) continue;

      const pod = podMap.get(`${metrics.namespace}/${metrics.podName}`);

      if (metrics.restartCount >= this.thresholds.restartCritical) {
        this.createIncident({
          title: `Critical Restart Count: ${metrics.podName}`,
          description: `Pod has restarted ${metrics.restartCount} times`,
          severity: "critical",
          category: "persistent-restarts",
          resource: metrics.podName,
          resourceType: "pod",
          namespace: metrics.namespace,
          metrics: { restartCount: metrics.restartCount },
        });
        this.setCooldown(cooldownKey);
      } else if (metrics.restartCount >= this.thresholds.restartWarning) {
        this.createIncident({
          title: `High Restart Count: ${metrics.podName}`,
          description: `Pod has restarted ${metrics.restartCount} times`,
          severity: "medium",
          category: "persistent-restarts",
          resource: metrics.podName,
          resourceType: "pod",
          namespace: metrics.namespace,
          metrics: { restartCount: metrics.restartCount },
        });
        this.setCooldown(cooldownKey);
      }

      if (pod?.status === "failed") {
        this.createIncident({
          title: `Pod Failed: ${metrics.podName}`,
          description: `Pod ${metrics.podName} is in Failed state`,
          severity: "high",
          category: "pod-crash",
          resource: metrics.podName,
          resourceType: "pod",
          namespace: metrics.namespace,
          metrics: { restartCount: metrics.restartCount },
        });
        this.setCooldown(cooldownKey);
      }

      if (metrics.memoryLimitBytes > 0) {
        const memoryPercent = (metrics.memoryUsageBytes / metrics.memoryLimitBytes) * 100;
        if (memoryPercent >= this.thresholds.memoryCritical) {
          this.createIncident({
            title: `Pod Near OOM: ${metrics.podName}`,
            description: `Pod memory at ${memoryPercent.toFixed(1)}% of limit`,
            severity: "critical",
            category: "oom-killed",
            resource: metrics.podName,
            resourceType: "pod",
            namespace: metrics.namespace,
            metrics: { memoryPercent, memoryUsageBytes: metrics.memoryUsageBytes },
          });
          this.setCooldown(cooldownKey);
        }
      }
    }
  }

  private createIncident(params: {
    title: string;
    description: string;
    severity: IncidentSeverity;
    category: IncidentCategory;
    resource: string;
    resourceType: "pod" | "node" | "deployment" | "service";
    namespace: string;
    metrics: Record<string, number>;
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
    
    const alert = this.createAlert(incident);
    incident.relatedAlerts.push(alert.id);

    logger.info(
      { incidentId: incident.id, severity: incident.severity, resource: incident.resource },
      "Incident detected"
    );

    emitAlert("default", alert);

    return incident;
  }

  private createAlert(incident: Incident): Alert {
    const severityMap: Record<IncidentSeverity, AlertSeverity> = {
      low: "info",
      medium: "warning",
      high: "warning",
      critical: "critical",
    };

    const alert: Alert = {
      id: uuidv4(),
      severity: severityMap[incident.severity],
      title: incident.title,
      message: incident.description,
      resource: incident.resource,
      namespace: incident.namespace,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    this.alerts.set(alert.id, alert);
    return alert;
  }

  private async processAutoHealing() {
    const openIncidents = this.getIncidents("open");
    
    for (const incident of openIncidents) {
      if (incident.autoHealingAttempted) continue;

      if (this.shouldAutoHeal(incident)) {
        await this.attemptAutoHealing(incident);
      } else if (this.shouldEscalate(incident)) {
        this.escalateIncident(incident);
      }
    }
  }

  private shouldAutoHeal(incident: Incident): boolean {
    return (
      (incident.severity === "low" || incident.severity === "medium") &&
      (incident.category === "persistent-restarts" ||
        incident.category === "pod-crash" ||
        incident.category === "high-cpu" ||
        incident.category === "high-memory") &&
      incident.resourceType === "pod"
    );
  }

  private shouldEscalate(incident: Incident): boolean {
    return incident.severity === "high" || incident.severity === "critical";
  }

  private async attemptAutoHealing(incident: Incident) {
    incident.autoHealingAttempted = true;
    incident.autoHealingResult = "pending";
    incident.status = "healing";
    this.incidents.set(incident.id, incident);

    logger.info(
      { incidentId: incident.id, resource: incident.resource },
      "Attempting auto-healing"
    );

    try {
      const matchingRules = healingService.getRules().filter(
        (rule) => rule.enabled && this.ruleMatchesIncident(rule, incident)
      );

      if (matchingRules.length > 0) {
        const rule = matchingRules[0];
        const event = await healingService.executeAction(
          rule,
          incident.resource,
          incident.namespace
        );

        incident.autoHealingResult = event.status === "success" ? "success" : "failed";
        
        if (event.status === "success") {
          incident.status = "resolved";
          incident.resolvedAt = new Date().toISOString();
        } else {
          this.escalateIncident(incident);
        }

        emitHealingEvent("default", event);
      } else {
        incident.autoHealingResult = "failed";
        this.escalateIncident(incident);
      }
    } catch (error) {
      logger.error({ error, incidentId: incident.id }, "Auto-healing failed");
      incident.autoHealingResult = "failed";
      this.escalateIncident(incident);
    }

    this.incidents.set(incident.id, incident);
  }

  private ruleMatchesIncident(rule: { trigger: { type: string } }, incident: Incident): boolean {
    const categoryToTriggerMap: Record<string, string[]> = {
      "pod-crash": ["pod-crash"],
      "high-cpu": ["high-cpu"],
      "high-memory": ["high-memory"],
      "oom-killed": ["high-memory", "oom-killed"],
      "persistent-restarts": ["pod-crash"],
    };

    const matchingTriggers = categoryToTriggerMap[incident.category] || [];
    return matchingTriggers.includes(rule.trigger.type);
  }

  private escalateIncident(incident: Incident) {
    incident.escalated = true;
    incident.escalatedAt = new Date().toISOString();
    incident.status = "escalated";
    this.incidents.set(incident.id, incident);

    logger.warn(
      { incidentId: incident.id, severity: incident.severity, resource: incident.resource },
      "Incident escalated - requires manual intervention"
    );

    const escalationAlert: Alert = {
      id: uuidv4(),
      severity: "critical",
      title: `ESCALATED: ${incident.title}`,
      message: `Incident requires manual intervention. Auto-healing ${
        incident.autoHealingAttempted ? "failed" : "not applicable"
      }. ${incident.description}`,
      resource: incident.resource,
      namespace: incident.namespace,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    this.alerts.set(escalationAlert.id, escalationAlert);
    incident.relatedAlerts.push(escalationAlert.id);
    
    emitAlert("default", escalationAlert);
  }

  private isInCooldown(key: string): boolean {
    const lastTime = this.incidentCooldowns.get(key);
    if (!lastTime) return false;
    return Date.now() - lastTime < this.COOLDOWN_MS;
  }

  private setCooldown(key: string) {
    this.incidentCooldowns.set(key, Date.now());
  }

  getIncidentStats() {
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
        autoHealedSuccess: recent.filter((i) => i.autoHealingResult === "success").length,
        autoHealedFailed: recent.filter((i) => i.autoHealingResult === "failed").length,
        escalated: recent.filter((i) => i.escalated).length,
      },
    };
  }
}

export const incidentService = new IncidentService();
