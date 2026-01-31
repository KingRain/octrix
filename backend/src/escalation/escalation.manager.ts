import { createChildLogger } from "../utils/logger.js";
import { incidentDetector } from "../incidents/detector.js";
import { notificationService } from "./notifications.js";
import type { Incident, IncidentSeverity } from "../incidents/types.js";

const logger = createChildLogger("escalation-manager");

export interface EscalationPolicy {
  id: string;
  name: string;
  severity: IncidentSeverity;
  escalateAfterMinutes: number;
  notifyChannels: string[];
  freezeAutomation: boolean;
  requiresAck: boolean;
}

export interface EscalationRecord {
  incidentId: string;
  escalatedAt: string;
  policy: string;
  notificationsSent: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

class EscalationManager {
  private policies: EscalationPolicy[] = [
    {
      id: "critical-immediate",
      name: "Critical - Immediate Escalation",
      severity: "critical",
      escalateAfterMinutes: 0,
      notifyChannels: ["pagerduty", "slack", "email"],
      freezeAutomation: true,
      requiresAck: true,
    },
    {
      id: "high-5min",
      name: "High - 5 Minute Escalation",
      severity: "high",
      escalateAfterMinutes: 5,
      notifyChannels: ["slack", "email"],
      freezeAutomation: false,
      requiresAck: true,
    },
    {
      id: "medium-15min",
      name: "Medium - 15 Minute Escalation",
      severity: "medium",
      escalateAfterMinutes: 15,
      notifyChannels: ["slack"],
      freezeAutomation: false,
      requiresAck: false,
    },
  ];

  private escalationRecords: Map<string, EscalationRecord> = new Map();
  private automationFrozen: boolean = false;

  async escalate(incident: Incident): Promise<EscalationRecord> {
    const policy = this.getPolicyForSeverity(incident.severity);
    
    if (!policy) {
      logger.warn({ incidentId: incident.id, severity: incident.severity }, "No escalation policy found");
      return this.createBasicEscalation(incident);
    }

    logger.warn({
      incidentId: incident.id,
      severity: incident.severity,
      policy: policy.name,
    }, "Escalating incident");

    if (policy.freezeAutomation) {
      this.freezeAutomation(incident);
    }

    const notifications = await notificationService.sendNotification(incident);

    const record: EscalationRecord = {
      incidentId: incident.id,
      escalatedAt: new Date().toISOString(),
      policy: policy.name,
      notificationsSent: notifications.length,
      acknowledged: false,
    };

    this.escalationRecords.set(incident.id, record);
    incidentDetector.escalateIncident(incident.id);

    return record;
  }

  private createBasicEscalation(incident: Incident): EscalationRecord {
    const record: EscalationRecord = {
      incidentId: incident.id,
      escalatedAt: new Date().toISOString(),
      policy: "default",
      notificationsSent: 0,
      acknowledged: false,
    };
    this.escalationRecords.set(incident.id, record);
    return record;
  }

  private getPolicyForSeverity(severity: IncidentSeverity): EscalationPolicy | undefined {
    return this.policies.find((p) => p.severity === severity);
  }

  private freezeAutomation(incident: Incident) {
    this.automationFrozen = true;
    logger.warn({
      incidentId: incident.id,
      reason: "Critical incident detected",
    }, "Automation frozen - manual intervention required");
  }

  unfreezeAutomation(acknowledgedBy: string): boolean {
    if (!this.automationFrozen) return false;
    
    this.automationFrozen = false;
    logger.info({ acknowledgedBy }, "Automation unfrozen");
    return true;
  }

  isAutomationFrozen(): boolean {
    return this.automationFrozen;
  }

  acknowledgeEscalation(incidentId: string, acknowledgedBy: string): EscalationRecord | null {
    const record = this.escalationRecords.get(incidentId);
    if (!record) return null;

    record.acknowledged = true;
    record.acknowledgedBy = acknowledgedBy;
    record.acknowledgedAt = new Date().toISOString();
    this.escalationRecords.set(incidentId, record);

    logger.info({ incidentId, acknowledgedBy }, "Escalation acknowledged");
    return record;
  }

  getEscalationRecord(incidentId: string): EscalationRecord | undefined {
    return this.escalationRecords.get(incidentId);
  }

  getEscalationRecords(): EscalationRecord[] {
    return Array.from(this.escalationRecords.values()).sort((a, b) =>
      new Date(b.escalatedAt).getTime() - new Date(a.escalatedAt).getTime()
    );
  }

  getPolicies(): EscalationPolicy[] {
    return [...this.policies];
  }

  updatePolicy(id: string, updates: Partial<EscalationPolicy>): EscalationPolicy | null {
    const index = this.policies.findIndex((p) => p.id === id);
    if (index === -1) return null;

    this.policies[index] = { ...this.policies[index], ...updates };
    logger.info({ policyId: id, updates }, "Escalation policy updated");
    return this.policies[index];
  }

  getStats() {
    const records = Array.from(this.escalationRecords.values());
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recent = records.filter((r) => new Date(r.escalatedAt) >= last24h);

    return {
      total: records.length,
      last24h: recent.length,
      acknowledged: records.filter((r) => r.acknowledged).length,
      pending: records.filter((r) => !r.acknowledged).length,
      automationFrozen: this.automationFrozen,
    };
  }
}

export const escalationManager = new EscalationManager();
