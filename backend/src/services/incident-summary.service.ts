import { createChildLogger } from "../utils/logger.js";
import { kubernetesService } from "./kubernetes.service.js";
import { prometheusService } from "./prometheus.service.js";
import { incidentDetector } from "../incidents/detector.js";

const logger = createChildLogger("incident-summary-service");

export interface IncidentSummary {
  incidentId: string;
  rootSuspect: string;
  impact: string;
  signals: string[];
  classification: string;
  blastRadius: string;
  generatedAt: string;
}

export interface IncidentCommandOutput {
  label: string;
  command: string;
  output: string;
  updatedAt: string;
}

export interface IncidentLogs {
  incidentId: string;
  commands: IncidentCommandOutput[];
}

export interface IncidentContext {
  incident: {
    id: string;
    title: string;
    description: string;
    severity: string;
    category: string;
    resource: string;
    resourceType: string;
    namespace: string;
    metrics: Record<string, number>;
  };
  kubernetesEvents: Array<{
    type: string;
    reason: string;
    message: string;
    timestamp: string;
    involvedObject?: {
      kind: string;
      name: string;
      namespace: string;
    };
  }>;
  podStates: Array<{
    name: string;
    namespace: string;
    phase: string;
    restartCount: number;
    containerState: string;
    stateReason?: string;
    stateMessage?: string;
  }>;
  podLogs: Array<{
    podName: string;
    logs: string;
  }>;
  prometheusMetrics: Array<{
    name: string;
    value: number;
    description: string;
  }>;
  relatedPods: Array<{
    name: string;
    namespace: string;
    status: string;
    restartCount: number;
    cpuUsage: number;
    memoryUsage: number;
  }>;
}

export class IncidentSummaryService {
  async getIncidentLogs(incidentId: string): Promise<IncidentLogs> {
    logger.info({ incidentId }, "Collecting incident logs");

    try {
      const context = await this.collectIncidentContext(incidentId);
      const commands = await this.buildCommandOutputs(context);

      return {
        incidentId,
        commands,
      };
    } catch (error) {
      logger.error({ error, incidentId }, "Failed to collect incident logs");
      throw new Error("Failed to collect incident logs");
    }
  }

  async generateSummary(incidentId: string): Promise<IncidentSummary> {
    logger.info({ incidentId }, "Generating incident summary");

    try {
      const context = await this.collectIncidentContext(incidentId);
      const summary = await this.generateSummaryWithGemini(context);
      
      return {
        incidentId,
        ...summary,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error, incidentId }, "Failed to generate incident summary");
      throw new Error("Failed to generate incident summary");
    }
  }

  private async collectIncidentContext(incidentId: string): Promise<IncidentContext> {
    const incident = await this.getIncidentData(incidentId);
    
    const [kubernetesEvents, prometheusMetrics, relatedPods, podStates, podLogs] = await Promise.all([
      this.getKubernetesEvents(incident),
      this.getPrometheusMetrics(incident),
      this.getRelatedPods(incident),
      this.getPodStates(incident),
      this.getPodLogs(incident),
    ]);

    return {
      incident,
      kubernetesEvents,
      podStates,
      podLogs,
      prometheusMetrics,
      relatedPods,
    };
  }

  private async buildCommandOutputs(context: IncidentContext): Promise<IncidentCommandOutput[]> {
    const updatedAt = new Date().toISOString();
    const commands: IncidentCommandOutput[] = [];

    if (context.podLogs.length > 0) {
      context.podLogs.forEach((log) => {
        commands.push({
          label: "kubectl logs",
          command: `kubectl logs pod/${log.podName} -n ${context.incident.namespace} --tail=50`,
          output: log.logs || "No logs available.",
          updatedAt,
        });
      });
    } else {
      commands.push({
        label: "kubectl logs",
        command: `kubectl logs pod/${context.incident.resource} -n ${context.incident.namespace} --tail=50`,
        output: "No logs available for this incident.",
        updatedAt,
      });
    }

    commands.push({
      label: "kubectl describe",
      command: `kubectl describe ${context.incident.resourceType}/${context.incident.resource} -n ${context.incident.namespace}`,
      output: await this.getDescribeOutput(context),
      updatedAt,
    });

    commands.push({
      label: "kubectl get events",
      command: `kubectl get events -n ${context.incident.namespace} --sort-by=.lastTimestamp`,
      output: this.formatEventsOutput(context.kubernetesEvents),
      updatedAt,
    });

    commands.push({
      label: "kubectl get pods",
      command: `kubectl get pods -n ${context.incident.namespace}`,
      output: this.formatPodsOutput(context.relatedPods),
      updatedAt,
    });

    commands.push({
      label: "prometheus metrics",
      command: `prometheus: incident metrics for ${context.incident.resource}`,
      output: this.formatMetricsOutput(context.prometheusMetrics),
      updatedAt,
    });

    return commands;
  }

  private formatEventsOutput(events: IncidentContext["kubernetesEvents"]): string {
    if (!events.length) {
      return "No events found in namespace.";
    }

    const header = "LAST SEEN\tTYPE\tREASON\tOBJECT\tMESSAGE";
    const rows = events.slice(0, 30).map((event) => {
      const ts = new Date(event.timestamp).toLocaleString();
      const obj = event.involvedObject ? `${event.involvedObject.kind}/${event.involvedObject.name}` : "-";
      const message = event.message.replace(/\s+/g, " ").trim();
      return `${ts}\t${event.type}\t${event.reason}\t${obj}\t${message}`;
    });

    return [header, ...rows].join("\n");
  }

  private formatPodsOutput(pods: IncidentContext["relatedPods"]): string {
    if (!pods.length) {
      return "No related pods found.";
    }

    const header = "NAME\tSTATUS\tRESTARTS\tCPU(cores)\tMEMORY(MB)";
    const rows = pods.map((pod) => {
      const memoryMb = pod.memoryUsage ? (pod.memoryUsage / (1024 * 1024)).toFixed(2) : "0.00";
      return `${pod.name}\t${pod.status}\t${pod.restartCount}\t${pod.cpuUsage.toFixed(2)}\t${memoryMb}`;
    });

    return [header, ...rows].join("\n");
  }

  private formatMetricsOutput(metrics: IncidentContext["prometheusMetrics"]): string {
    if (!metrics.length) {
      return "No Prometheus metrics available.";
    }

    return metrics
      .map((metric) => `${metric.name}: ${metric.value.toFixed(2)} (${metric.description})`)
      .join("\n");
  }

  private async getDescribeOutput(context: IncidentContext): Promise<string> {
    if (context.incident.resourceType !== "pod") {
      return `Describe output for ${context.incident.resourceType} resources is not available.`;
    }

    try {
      const pods = await kubernetesService.getPods(context.incident.namespace);
      const targetPod = pods.find((pod) => pod.name === context.incident.resource)
        || pods.find((pod) => pod.name.includes(context.incident.resource.split("-")[0]));
      const podState = context.podStates.find((pod) => pod.name === targetPod?.name);

      if (!targetPod) {
        return "Pod not found in namespace.";
      }

      const labels = Object.entries(targetPod.labels || {}).map(([key, value]) => `${key}=${value}`).join(", ") || "<none>";
      const annotations = Object.entries(targetPod.annotations || {}).map(([key, value]) => `${key}=${value}`).join(", ") || "<none>";
      const owners = (targetPod.ownerReferences || []).map((o) => `${o.kind}/${o.name}`).join(", ") || "<none>";

      const lines: string[] = [
        `Name:\t${targetPod.name}`,
        `Namespace:\t${targetPod.namespace}`,
        `Node:\t${targetPod.nodeName || "unknown"}`,
        `Status:\t${targetPod.status}`,
        `Phase:\t${targetPod.phase}`,
        `IP:\t${targetPod.ip || "unknown"}`,
        `Restarts:\t${targetPod.restarts}`,
        `Start Time:\t${targetPod.createdAt || "unknown"}`,
        `Labels:\t${labels}`,
        `Annotations:\t${annotations}`,
        `Owner References:\t${owners}`,
        "",
        "Containers:",
      ];

      targetPod.containers.forEach((container) => {
        lines.push(
          `  ${container.name}:`,
          `    Image:\t${container.image}`,
          `    State:\t${container.status}`,
          `    Ready:\t${container.ready}`,
          `    Restarts:\t${container.restartCount}`
        );
      });

      if (podState) {
        lines.push(
          "",
          `Container State:\t${podState.containerState}`,
          podState.stateReason ? `State Reason:\t${podState.stateReason}` : "",
          podState.stateMessage ? `State Message:\t${podState.stateMessage}` : ""
        );
      }

      return lines.filter(Boolean).join("\n");
    } catch (error) {
      logger.error({ error }, "Failed to build describe output");
      return "Failed to fetch pod details.";
    }
  }

  private async getIncidentData(incidentId: string) {
    const incident = incidentDetector.getIncident(incidentId);
    
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    return {
      id: incident.id,
      title: incident.title,
      description: incident.description,
      severity: incident.severity,
      category: incident.category,
      resource: incident.resource,
      resourceType: incident.resourceType,
      namespace: incident.namespace,
      metrics: Object.fromEntries(
        Object.entries(incident.metrics).filter(([, value]) => typeof value === "number") as Array<[string, number]>
      ),
    };
  }

  private async getKubernetesEvents(incident: any): Promise<Array<{
    type: string;
    reason: string;
    message: string;
    timestamp: string;
    involvedObject?: {
      kind: string;
      name: string;
      namespace: string;
    };
  }>> {
    try {
      // Get all events in the namespace to capture related issues
      const allEvents = await kubernetesService.getAllEvents(incident.namespace);
      
      // Sort by timestamp descending and take recent events
      return allEvents
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20);
    } catch (error) {
      logger.error({ error }, "Failed to get Kubernetes events");
      return [];
    }
  }

  private async getPrometheusMetrics(incident: any): Promise<Array<{
    name: string;
    value: number;
    description: string;
  }>> {
    try {
      const metrics: Array<{ name: string; value: number; description: string }> = [];

      if (incident.resourceType === "pod") {
        const podMetrics = await prometheusService.getPodMetrics(incident.namespace);
        const targetPod = podMetrics.find((p) => p.podName === incident.resource);

        if (targetPod) {
          metrics.push({
            name: "CPU Usage",
            value: targetPod.cpuUsageCores,
            description: "CPU usage in cores",
          });
          metrics.push({
            name: "Memory Usage",
            value: targetPod.memoryUsageBytes / (1024 * 1024),
            description: "Memory usage in MB",
          });
          metrics.push({
            name: "Restart Count",
            value: targetPod.restartCount,
            description: "Number of pod restarts",
          });
        }
      }

      return metrics;
    } catch (error) {
      logger.error({ error }, "Failed to get Prometheus metrics");
      return [];
    }
  }

  private async getRelatedPods(incident: any): Promise<Array<{
    name: string;
    namespace: string;
    status: string;
    restartCount: number;
    cpuUsage: number;
    memoryUsage: number;
  }>> {
    try {
      const pods = await kubernetesService.getPods(incident.namespace);
      const podMetrics = await prometheusService.getPodMetrics(incident.namespace);

      return pods
        .slice(0, 5)
        .map((pod) => {
          const metrics = podMetrics.find((m) => m.podName === pod.name);
          return {
            name: pod.name,
            namespace: pod.namespace,
            status: pod.status,
            restartCount: pod.restarts,
            cpuUsage: metrics?.cpuUsageCores || 0,
            memoryUsage: metrics?.memoryUsageBytes || 0,
          };
        });
    } catch (error) {
      logger.error({ error }, "Failed to get related pods");
      return [];
    }
  }

  private async getPodStates(incident: any): Promise<Array<{
    name: string;
    namespace: string;
    phase: string;
    restartCount: number;
    containerState: string;
    stateReason?: string;
    stateMessage?: string;
  }>> {
    try {
      const pods = await kubernetesService.getPods(incident.namespace);
      const podStates: Array<{
        name: string;
        namespace: string;
        phase: string;
        restartCount: number;
        containerState: string;
        stateReason?: string;
        stateMessage?: string;
      }> = [];

      for (const pod of pods.slice(0, 10)) {
        const status = await kubernetesService.getPodStatus(pod.namespace, pod.name);
        if (status) {
          const containerStatus = status.containerStatuses[0];
          podStates.push({
            name: pod.name,
            namespace: pod.namespace,
            phase: status.phase,
            restartCount: containerStatus?.restartCount || 0,
            containerState: containerStatus?.state || "unknown",
            stateReason: containerStatus?.stateReason,
            stateMessage: containerStatus?.stateMessage,
          });
        }
      }

      return podStates;
    } catch (error) {
      logger.error({ error }, "Failed to get pod states");
      return [];
    }
  }

  private async getPodLogs(incident: any): Promise<Array<{
    podName: string;
    logs: string;
  }>> {
    try {
      const pods = await kubernetesService.getPods(incident.namespace);
      const podLogs: Array<{ podName: string; logs: string }> = [];

      // Get logs for the incident resource and related pods
      const targetPods = pods.filter(
        (p) => p.name === incident.resource || p.name.includes(incident.resource.split("-")[0])
      ).slice(0, 5);

      for (const pod of targetPods) {
        const logs = await kubernetesService.getPodLogs(pod.namespace, pod.name, 50);
        if (logs) {
          podLogs.push({
            podName: pod.name,
            logs: logs.slice(-2000), // Limit log size
          });
        }
      }

      return podLogs;
    } catch (error) {
      logger.error({ error }, "Failed to get pod logs");
      return [];
    }
  }

  private async generateSummaryWithGemini(context: IncidentContext): Promise<{
    rootSuspect: string;
    impact: string;
    signals: string[];
    classification: string;
    blastRadius: string;
  }> {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      logger.warn("GEMINI_API_KEY not configured, using fallback summary");
      return this.generateFallbackSummary(context);
    }

    const prompt = this.buildPrompt(context);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      };
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return this.parseGeminiResponse(generatedText, context);
    } catch (error) {
      logger.error({ error }, "Failed to generate summary with Gemini");
      return this.generateFallbackSummary(context);
    }
  }

  private buildPrompt(context: IncidentContext): string {
    const incident = context.incident;
    
    let prompt = `You are a Kubernetes incident analysis expert. Analyze the following incident data and generate a concise summary in EXACTLY this format:

Incident #${incident.id.slice(0, 8)}
Root suspect: [resource name] ([status/condition like CrashLoopBackOff, OOMKilled, etc])
Impact: [affected resources] ([count] pods) experiencing [issue type]
Signals:
- [signal 1 - specific observation from logs/events]
- [signal 2 - specific observation]
- [signal 3 - specific observation]
Classification: [workload failure / resource exhaustion / network issue / configuration error]
Blast radius: [N] workloads

INCIDENT DETAILS:
- Title: ${incident.title}
- Description: ${incident.description}
- Severity: ${incident.severity}
- Category: ${incident.category}
- Resource: ${incident.resource} (${incident.resourceType})
- Namespace: ${incident.namespace}

`;

    if (context.podStates.length > 0) {
      prompt += "\nPOD STATES (from Kubernetes API):\n";
      context.podStates.forEach((pod) => {
        prompt += `- ${pod.name}: phase=${pod.phase}, state=${pod.containerState}, restarts=${pod.restartCount}`;
        if (pod.stateReason) prompt += `, reason=${pod.stateReason}`;
        if (pod.stateMessage) prompt += `, message=${pod.stateMessage.slice(0, 100)}`;
        prompt += "\n";
      });
    }

    if (context.kubernetesEvents.length > 0) {
      prompt += "\nKUBERNETES EVENTS:\n";
      context.kubernetesEvents.slice(0, 10).forEach((event) => {
        const objInfo = event.involvedObject ? ` [${event.involvedObject.kind}/${event.involvedObject.name}]` : "";
        prompt += `- ${event.type}: ${event.reason}${objInfo} - ${event.message.slice(0, 150)}\n`;
      });
    }

    if (context.podLogs.length > 0) {
      prompt += "\nPOD LOGS (recent):\n";
      context.podLogs.forEach((log) => {
        prompt += `--- ${log.podName} ---\n${log.logs.slice(-500)}\n`;
      });
    }

    if (context.prometheusMetrics.length > 0) {
      prompt += "\nMETRICS:\n";
      context.prometheusMetrics.forEach((metric) => {
        prompt += `- ${metric.name}: ${metric.value.toFixed(2)} ${metric.description}\n`;
      });
    }

    if (context.relatedPods.length > 0) {
      prompt += "\nRELATED PODS:\n";
      context.relatedPods.forEach((pod) => {
        prompt += `- ${pod.name} (${pod.status}): ${pod.restartCount} restarts, CPU: ${pod.cpuUsage.toFixed(2)} cores\n`;
      });
    }

    prompt += `
INSTRUCTIONS:
1. Identify the root suspect pod/resource and its state (e.g., CrashLoopBackOff, OOMKilled)
2. Determine the impact on other pods (look for connection errors, failures in logs)
3. List 3-5 specific, non-repetitive signals from the logs and events (each signal must highlight a distinct observation)
4. Classify the incident type
5. Count affected workloads for blast radius

Generate a summary following the EXACT format specified above. Be concise and factual. Use actual data from the logs and events.`;

    return prompt;
  }

  private parseGeminiResponse(
    text: string,
    context: IncidentContext
  ): {
    rootSuspect: string;
    impact: string;
    signals: string[];
    classification: string;
    blastRadius: string;
  } {
    const lines = text.split("\n").map((line) => line.trim()).filter((line) => line);

    const result = {
      rootSuspect: `${context.incident.resource} (${context.incident.category})`,
      impact: `${context.incident.resourceType} in ${context.incident.namespace}`,
      signals: [
        `Detected at ${new Date(context.incident.metrics.timestamp || Date.now()).toLocaleString()}`,
        `Severity: ${context.incident.severity}`,
      ],
      classification: context.incident.category,
      blastRadius: "1 workload",
    };

    for (const line of lines) {
      if (line.toLowerCase().startsWith("root suspect:")) {
        result.rootSuspect = line.substring(14).trim();
      } else if (line.toLowerCase().startsWith("impact:")) {
        result.impact = line.substring(8).trim();
      } else if (line.toLowerCase().startsWith("classification:")) {
        result.classification = line.substring(15).trim();
      } else if (line.toLowerCase().startsWith("blast radius:")) {
        result.blastRadius = line.substring(13).trim();
      } else if (line.startsWith("-")) {
        result.signals.push(line.substring(1).trim());
      }
    }

    return result;
  }

  private generateFallbackSummary(context: IncidentContext): {
    rootSuspect: string;
    impact: string;
    signals: string[];
    classification: string;
    blastRadius: string;
  } {
    const incident = context.incident;
    
    const signals: string[] = [
      `Severity: ${incident.severity}`,
      `Category: ${incident.category}`,
    ];

    if (context.kubernetesEvents.length > 0) {
      const recentEvents = context.kubernetesEvents.slice(0, 3);
      recentEvents.forEach((event) => {
        signals.push(`Event: ${event.reason} - ${event.message.substring(0, 50)}...`);
      });
    }

    if (context.prometheusMetrics.length > 0) {
      context.prometheusMetrics.forEach((metric) => {
        signals.push(`${metric.name}: ${metric.value.toFixed(2)}`);
      });
    }

    return {
      rootSuspect: `${incident.resource} (${incident.category})`,
      impact: `${incident.resourceType} in ${incident.namespace}`,
      signals,
      classification: incident.category,
      blastRadius: "1 workload",
    };
  }
}

export const incidentSummaryService = new IncidentSummaryService();
