import { v4 as uuidv4 } from "uuid";
import { createChildLogger } from "../utils/logger.js";
import type { Incident, IncidentSeverity } from "../incidents/types.js";

const logger = createChildLogger("notifications");

export type NotificationChannel = "slack" | "pagerduty" | "email" | "webhook" | "console";
export type NotificationPriority = "low" | "medium" | "high" | "critical";

export interface Notification {
  id: string;
  incidentId: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  title: string;
  message: string;
  sentAt: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface NotificationConfig {
  channel: NotificationChannel;
  enabled: boolean;
  minSeverity: IncidentSeverity;
  webhookUrl?: string;
  recipients?: string[];
}

class NotificationService {
  private notifications: Map<string, Notification> = new Map();
  private configs: NotificationConfig[] = [
    { channel: "console", enabled: true, minSeverity: "low" },
    { channel: "slack", enabled: false, minSeverity: "medium" },
    { channel: "pagerduty", enabled: false, minSeverity: "critical" },
    { channel: "email", enabled: false, minSeverity: "high" },
  ];

  async sendNotification(incident: Incident): Promise<Notification[]> {
    const sentNotifications: Notification[] = [];
    const priority = this.mapSeverityToPriority(incident.severity);

    for (const config of this.configs) {
      if (!config.enabled) continue;
      if (!this.shouldNotify(incident.severity, config.minSeverity)) continue;

      const notification = await this.send(incident, config.channel, priority);
      sentNotifications.push(notification);
    }

    return sentNotifications;
  }

  private async send(
    incident: Incident,
    channel: NotificationChannel,
    priority: NotificationPriority
  ): Promise<Notification> {
    const notification: Notification = {
      id: uuidv4(),
      incidentId: incident.id,
      channel,
      priority,
      title: `[${incident.severity.toUpperCase()}] ${incident.title}`,
      message: this.formatMessage(incident),
      sentAt: new Date().toISOString(),
      acknowledged: false,
    };

    this.notifications.set(notification.id, notification);

    switch (channel) {
      case "console":
        this.sendToConsole(notification, incident);
        break;
      case "slack":
        await this.sendToSlack(notification, incident);
        break;
      case "pagerduty":
        await this.sendToPagerDuty(notification, incident);
        break;
      case "email":
        await this.sendEmail(notification, incident);
        break;
      case "webhook":
        await this.sendWebhook(notification, incident);
        break;
    }

    return notification;
  }

  private sendToConsole(notification: Notification, incident: Incident) {
    const severityColors: Record<IncidentSeverity, string> = {
      low: "\x1b[34m",
      medium: "\x1b[33m",
      high: "\x1b[35m",
      critical: "\x1b[31m",
    };
    const reset = "\x1b[0m";
    const color = severityColors[incident.severity];

    logger.warn({
      notificationId: notification.id,
      severity: incident.severity,
      title: incident.title,
      resource: incident.resource,
      suggestedAction: incident.suggestedAction,
    }, `${color}ALERT${reset}: ${notification.title}`);
  }

  private async sendToSlack(notification: Notification, incident: Incident) {
    logger.info({ channel: "slack", incidentId: incident.id }, "Slack notification (simulated)");
  }

  private async sendToPagerDuty(notification: Notification, incident: Incident) {
    logger.info({ channel: "pagerduty", incidentId: incident.id }, "PagerDuty alert (simulated)");
  }

  private async sendEmail(notification: Notification, incident: Incident) {
    logger.info({ channel: "email", incidentId: incident.id }, "Email notification (simulated)");
  }

  private async sendWebhook(notification: Notification, incident: Incident) {
    logger.info({ channel: "webhook", incidentId: incident.id }, "Webhook notification (simulated)");
  }

  private formatMessage(incident: Incident): string {
    return `
Incident: ${incident.title}
Severity: ${incident.severity.toUpperCase()}
Category: ${incident.category}
Resource: ${incident.resource}
Namespace: ${incident.namespace}
Detected: ${incident.detectedAt}
Auto-Healable: ${incident.autoHealable ? "Yes" : "No"}
Suggested Action: ${incident.suggestedAction}
Production Behavior: ${incident.productionBehavior}
    `.trim();
  }

  private mapSeverityToPriority(severity: IncidentSeverity): NotificationPriority {
    const map: Record<IncidentSeverity, NotificationPriority> = {
      low: "low",
      medium: "medium",
      high: "high",
      critical: "critical",
    };
    return map[severity];
  }

  private shouldNotify(incidentSeverity: IncidentSeverity, minSeverity: IncidentSeverity): boolean {
    const severityOrder: IncidentSeverity[] = ["low", "medium", "high", "critical"];
    return severityOrder.indexOf(incidentSeverity) >= severityOrder.indexOf(minSeverity);
  }

  getNotifications(incidentId?: string): Notification[] {
    const notifications = Array.from(this.notifications.values());
    if (incidentId) {
      return notifications.filter((n) => n.incidentId === incidentId);
    }
    return notifications.sort((a, b) => 
      new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    );
  }

  acknowledgeNotification(id: string, acknowledgedBy?: string): Notification | null {
    const notification = this.notifications.get(id);
    if (!notification) return null;

    notification.acknowledged = true;
    notification.acknowledgedAt = new Date().toISOString();
    notification.acknowledgedBy = acknowledgedBy;
    this.notifications.set(id, notification);
    return notification;
  }

  updateConfig(channel: NotificationChannel, updates: Partial<NotificationConfig>): boolean {
    const config = this.configs.find((c) => c.channel === channel);
    if (!config) return false;

    Object.assign(config, updates);
    logger.info({ channel, updates }, "Notification config updated");
    return true;
  }

  getConfigs(): NotificationConfig[] {
    return [...this.configs];
  }
}

export const notificationService = new NotificationService();
