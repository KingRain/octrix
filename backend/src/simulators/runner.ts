import { v4 as uuidv4 } from "uuid";
import { createChildLogger } from "../utils/logger.js";
import { scenarioManager, type SimulationScenario, type SimulationRun, type SimulationMetric } from "./scenarios.js";
import { incidentDetector } from "../incidents/detector.js";

const logger = createChildLogger("simulation-runner");

interface ActiveSimulation {
  run: SimulationRun;
  scenario: SimulationScenario;
  timeoutId?: NodeJS.Timeout;
  cleanupFn?: () => Promise<void>;
}

class SimulationRunner {
  private runs: Map<string, SimulationRun> = new Map();
  private activeSimulations: Map<string, ActiveSimulation> = new Map();

  getRuns(limit = 50): SimulationRun[] {
    return Array.from(this.runs.values())
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  getRun(id: string): SimulationRun | undefined {
    return this.runs.get(id);
  }

  getActiveRuns(): SimulationRun[] {
    return Array.from(this.activeSimulations.values()).map((s) => s.run);
  }

  async startSimulation(
    scenarioId: string,
    targetNamespace: string,
    targetResource?: string,
    customDuration?: number
  ): Promise<SimulationRun> {
    const scenario = scenarioManager.getScenario(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    const duration = customDuration || scenario.duration;

    const run: SimulationRun = {
      id: uuidv4(),
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status: "pending",
      startTime: new Date().toISOString(),
      targetNamespace,
      targetResource,
      affectedResources: [],
      metrics: [],
    };

    this.runs.set(run.id, run);

    try {
      run.status = "running";
      this.runs.set(run.id, run);

      const activeSimulation: ActiveSimulation = {
        run,
        scenario,
      };

      await this.executeScenario(activeSimulation);
      this.activeSimulations.set(run.id, activeSimulation);

      activeSimulation.timeoutId = setTimeout(async () => {
        await this.stopSimulation(run.id);
      }, duration * 1000);

      logger.info({
        runId: run.id,
        scenario: scenario.name,
        duration,
        targetNamespace,
      }, "Simulation started");

      return run;
    } catch (error) {
      run.status = "failed";
      run.endTime = new Date().toISOString();
      this.runs.set(run.id, run);
      logger.error({ error, runId: run.id }, "Simulation failed to start");
      throw error;
    }
  }

  async stopSimulation(runId: string): Promise<SimulationRun | null> {
    const active = this.activeSimulations.get(runId);
    if (!active) {
      return this.runs.get(runId) || null;
    }

    if (active.timeoutId) {
      clearTimeout(active.timeoutId);
    }

    if (active.cleanupFn) {
      try {
        await active.cleanupFn();
      } catch (error) {
        logger.error({ error, runId }, "Cleanup failed");
      }
    }

    active.run.status = "completed";
    active.run.endTime = new Date().toISOString();
    this.runs.set(runId, active.run);
    this.activeSimulations.delete(runId);

    logger.info({ runId, scenario: active.scenario.name }, "Simulation completed");
    return active.run;
  }

  async cancelSimulation(runId: string): Promise<SimulationRun | null> {
    const active = this.activeSimulations.get(runId);
    if (!active) return null;

    if (active.timeoutId) {
      clearTimeout(active.timeoutId);
    }

    if (active.cleanupFn) {
      try {
        await active.cleanupFn();
      } catch (error) {
        logger.error({ error, runId }, "Cleanup failed during cancellation");
      }
    }

    active.run.status = "cancelled";
    active.run.endTime = new Date().toISOString();
    this.runs.set(runId, active.run);
    this.activeSimulations.delete(runId);

    logger.info({ runId }, "Simulation cancelled");
    return active.run;
  }

  private async executeScenario(simulation: ActiveSimulation) {
    const { scenario, run } = simulation;

    switch (scenario.type) {
      case "oom-killed":
        await this.simulateOOMKilled(simulation);
        break;
      case "high-cpu":
        await this.simulateHighCPU(simulation);
        break;
      case "crash-loop":
        await this.simulateCrashLoop(simulation);
        break;
      case "pod-throttling":
        await this.simulatePodThrottling(simulation);
        break;
      case "underutilization":
        await this.simulateUnderutilization(simulation);
        break;
      case "node-eviction":
        await this.simulateNodeEviction(simulation);
        break;
      case "image-pull-delay":
        await this.simulateImagePullDelay(simulation);
        break;
      case "buggy-deployment":
        await this.simulateBuggyDeployment(simulation);
        break;
      case "configmap-error":
        await this.simulateConfigMapError(simulation);
        break;
      case "db-failure":
        await this.simulateDBFailure(simulation);
        break;
      case "unknown-crash":
        await this.simulateUnknownCrash(simulation);
        break;
      case "multi-service-failure":
        await this.simulateMultiServiceFailure(simulation);
        break;
      default:
        throw new Error(`Unknown scenario type: ${scenario.type}`);
    }
  }

  private async simulateOOMKilled(simulation: ActiveSimulation) {
    const { scenario, run } = simulation;
    const prefix = run.targetResource || "cdn-cache";
    const resourceName = `${prefix}-${uuidv4().slice(0, 8)}`;
    
    run.affectedResources.push(`${run.targetNamespace}/${resourceName}`);
    run.metrics.push({
      name: "Memory Usage",
      before: 50,
      during: 128,
      after: 50,
      unit: "Mi",
    });

    const incident = incidentDetector.injectSimulatedIncident({
      title: `OOMKilled: ${resourceName}`,
      description: scenario.productionBehavior,
      severity: scenario.severity,
      category: scenario.incidentCategory,
      resource: resourceName,
      resourceType: "pod",
      namespace: run.targetNamespace,
      autoHealable: scenario.autoHealable,
      suggestedAction: "Patch memory limit & restart pod",
      productionBehavior: scenario.productionBehavior,
      metrics: { memoryLimitMi: 64, memoryUsedMi: 128, oomKilled: true },
    });

    run.incidentId = incident.id;
    logger.info({ resourceName, incidentId: incident.id }, "OOMKilled simulation injected");
  }

  private async simulateHighCPU(simulation: ActiveSimulation) {
    const { scenario, run } = simulation;
    const prefix = run.targetResource || "streaming-service";
    const resourceName = `${prefix}-${uuidv4().slice(0, 8)}`;
    const cpuLoad = (scenario.parameters.cpuLoadPercent as number) || 90;
    
    run.affectedResources.push(`${run.targetNamespace}/${resourceName}`);
    run.metrics.push({
      name: "CPU Usage",
      before: 30,
      during: cpuLoad,
      after: 30,
      unit: "percent",
    });

    const incident = incidentDetector.injectSimulatedIncident({
      title: `High CPU: ${resourceName}`,
      description: scenario.productionBehavior,
      severity: scenario.severity,
      category: scenario.incidentCategory,
      resource: resourceName,
      resourceType: "pod",
      namespace: run.targetNamespace,
      autoHealable: scenario.autoHealable,
      suggestedAction: "Scale replicas horizontally",
      productionBehavior: scenario.productionBehavior,
      metrics: { cpuUsagePercent: cpuLoad, throttled: false },
    });

    run.incidentId = incident.id;
    logger.info({ resourceName, cpuLoad, incidentId: incident.id }, "High CPU simulation injected");
  }

  private async simulateCrashLoop(simulation: ActiveSimulation) {
    const { scenario, run } = simulation;
    const prefix = run.targetResource || "api-server";
    const resourceName = `${prefix}-${uuidv4().slice(0, 8)}`;
    const restartCount = (scenario.parameters.restartCount as number) || 5;
    
    run.affectedResources.push(`${run.targetNamespace}/${resourceName}`);
    run.metrics.push({
      name: "Restart Count",
      before: 0,
      during: restartCount,
      after: 0,
      unit: "count",
    });

    const incident = incidentDetector.injectSimulatedIncident({
      title: `CrashLoopBackOff: ${resourceName}`,
      description: scenario.productionBehavior,
      severity: scenario.severity,
      category: scenario.incidentCategory,
      resource: resourceName,
      resourceType: "pod",
      namespace: run.targetNamespace,
      autoHealable: scenario.autoHealable,
      suggestedAction: "Restart with exponential backoff",
      productionBehavior: scenario.productionBehavior,
      metrics: { restartCount, exitCode: 1 },
    });

    run.incidentId = incident.id;
    logger.info({ resourceName, restartCount, incidentId: incident.id }, "CrashLoop simulation injected");
  }

  private async simulatePodThrottling(simulation: ActiveSimulation) {
    const { scenario, run } = simulation;
    const prefix = run.targetResource || "cdn-cache";
    const resourceName = `${prefix}-${uuidv4().slice(0, 8)}`;
    
    run.affectedResources.push(`${run.targetNamespace}/${resourceName}`);
    run.metrics.push({
      name: "CPU Throttling",
      before: 0,
      during: 80,
      after: 0,
      unit: "percent",
    });

    const incident = incidentDetector.injectSimulatedIncident({
      title: `CPU Throttling: ${resourceName}`,
      description: scenario.productionBehavior,
      severity: scenario.severity,
      category: scenario.incidentCategory,
      resource: resourceName,
      resourceType: "pod",
      namespace: run.targetNamespace,
      autoHealable: scenario.autoHealable,
      suggestedAction: "Increase CPU limit",
      productionBehavior: scenario.productionBehavior,
      metrics: { throttled: true, cpuLimitMillicores: 50 },
    });

    run.incidentId = incident.id;
    logger.info({ resourceName, incidentId: incident.id }, "Pod throttling simulation injected");
  }

  private async simulateUnderutilization(simulation: ActiveSimulation) {
    const { scenario, run } = simulation;
    const prefix = run.targetResource || "streaming-service";
    const resourceName = `${prefix}-${uuidv4().slice(0, 8)}`;
    
    run.affectedResources.push(`${run.targetNamespace}/${resourceName}`);
    run.metrics.push({
      name: "Resource Utilization",
      before: 40,
      during: 5,
      after: 40,
      unit: "percent",
    });

    const incident = incidentDetector.injectSimulatedIncident({
      title: `Underutilization: ${resourceName}`,
      description: scenario.productionBehavior,
      severity: scenario.severity,
      category: scenario.incidentCategory,
      resource: resourceName,
      resourceType: "deployment",
      namespace: run.targetNamespace,
      autoHealable: scenario.autoHealable,
      suggestedAction: "Scale down replicas",
      productionBehavior: scenario.productionBehavior,
      metrics: { cpuUsagePercent: 5, memoryUsagePercent: 8 },
    });

    run.incidentId = incident.id;
    logger.info({ resourceName, incidentId: incident.id }, "Underutilization simulation injected");
  }

  private async simulateNodeEviction(simulation: ActiveSimulation) {
    const { scenario, run } = simulation;
    const nodeName = run.targetResource || `node-${uuidv4().slice(0, 8)}`;
    
    run.affectedResources.push(nodeName);
    run.metrics.push({
      name: "Node Schedulable",
      before: 1,
      during: 0,
      after: 1,
      unit: "boolean",
    });

    const incident = incidentDetector.injectSimulatedIncident({
      title: `Node Eviction: ${nodeName}`,
      description: scenario.productionBehavior,
      severity: scenario.severity,
      category: scenario.incidentCategory,
      resource: nodeName,
      resourceType: "node",
      namespace: "cluster",
      autoHealable: scenario.autoHealable,
      suggestedAction: "Allow Kubernetes scheduler to handle rescheduling",
      productionBehavior: scenario.productionBehavior,
      metrics: { evicted: true, podsAffected: 5 },
    });

    run.incidentId = incident.id;
    logger.info({ nodeName, incidentId: incident.id }, "Node eviction simulation injected");
  }

  private async simulateImagePullDelay(simulation: ActiveSimulation) {
    const { scenario, run } = simulation;
    const prefix = run.targetResource || "api-server";
    const resourceName = `${prefix}-${uuidv4().slice(0, 8)}`;
    
    run.affectedResources.push(`${run.targetNamespace}/${resourceName}`);
    run.metrics.push({
      name: "Image Pull Time",
      before: 5,
      during: 60,
      after: 5,
      unit: "seconds",
    });

    const incident = incidentDetector.injectSimulatedIncident({
      title: `Image Pull Delay: ${resourceName}`,
      description: scenario.productionBehavior,
      severity: scenario.severity,
      category: scenario.incidentCategory,
      resource: resourceName,
      resourceType: "pod",
      namespace: run.targetNamespace,
      autoHealable: scenario.autoHealable,
      suggestedAction: "Retry image pull with backoff",
      productionBehavior: scenario.productionBehavior,
      metrics: { imagePullFailed: true, phase: "Pending" },
    });

    run.incidentId = incident.id;
    logger.info({ resourceName, incidentId: incident.id }, "Image pull delay simulation injected");
  }

  private async simulateBuggyDeployment(simulation: ActiveSimulation) {
    const { scenario, run } = simulation;
    const prefix = run.targetResource || "streaming-service";
    const resourceName = `${prefix}-${uuidv4().slice(0, 8)}`;
    const errorRate = (scenario.parameters.errorRate as number) || 50;
    
    run.affectedResources.push(`${run.targetNamespace}/${resourceName}`);
    run.metrics.push({
      name: "5xx Error Rate",
      before: 0,
      during: errorRate,
      after: 0,
      unit: "percent",
    });

    const incident = incidentDetector.injectSimulatedIncident({
      title: `Buggy Deployment: ${resourceName}`,
      description: scenario.productionBehavior,
      severity: scenario.severity,
      category: scenario.incidentCategory,
      resource: resourceName,
      resourceType: "deployment",
      namespace: run.targetNamespace,
      autoHealable: scenario.autoHealable,
      suggestedAction: "Alert developers, freeze deployments",
      productionBehavior: scenario.productionBehavior,
      metrics: { errorRate5xx: errorRate, errorCode: 500 },
    });

    run.incidentId = incident.id;
    logger.warn({ resourceName, errorRate, incidentId: incident.id }, "Buggy deployment simulation injected - ESCALATION REQUIRED");
  }

  private async simulateConfigMapError(simulation: ActiveSimulation) {
    const { scenario, run } = simulation;
    const prefix = run.targetResource || "api-server";
    const resourceName = `${prefix}-${uuidv4().slice(0, 8)}`;
    const missingVar = (scenario.parameters.missingEnvVar as string) || "DATABASE_URL";
    
    run.affectedResources.push(`${run.targetNamespace}/${resourceName}`);
    run.metrics.push({
      name: "Config Errors",
      before: 0,
      during: 1,
      after: 0,
      unit: "count",
    });

    const incident = incidentDetector.injectSimulatedIncident({
      title: `ConfigMap Error: ${resourceName}`,
      description: scenario.productionBehavior,
      severity: scenario.severity,
      category: scenario.incidentCategory,
      resource: resourceName,
      resourceType: "configmap",
      namespace: run.targetNamespace,
      autoHealable: scenario.autoHealable,
      suggestedAction: "Stop automation, alert ops team",
      productionBehavior: scenario.productionBehavior,
      metrics: { configError: true, missingEnvVar: missingVar },
    });

    run.incidentId = incident.id;
    logger.warn({ resourceName, missingVar, incidentId: incident.id }, "ConfigMap error simulation injected - ESCALATION REQUIRED");
  }

  private async simulateDBFailure(simulation: ActiveSimulation) {
    const { scenario, run } = simulation;
    const resourceName = run.targetResource || `db-service`;
    
    run.affectedResources.push(`${run.targetNamespace}/${resourceName}`);
    run.metrics.push({
      name: "DB Connections",
      before: 100,
      during: 0,
      after: 100,
      unit: "count",
    });

    const incident = incidentDetector.injectSimulatedIncident({
      title: `Database Failure: ${resourceName}`,
      description: scenario.productionBehavior,
      severity: scenario.severity,
      category: scenario.incidentCategory,
      resource: resourceName,
      resourceType: "service",
      namespace: run.targetNamespace,
      autoHealable: scenario.autoHealable,
      suggestedAction: "Freeze healing, alert DBA and on-call",
      productionBehavior: scenario.productionBehavior,
      metrics: { dbConnectionFailed: true, affectedServices: 10 },
    });

    run.incidentId = incident.id;
    logger.error({ resourceName, incidentId: incident.id }, "DB failure simulation injected - CRITICAL ESCALATION");
  }

  private async simulateUnknownCrash(simulation: ActiveSimulation) {
    const { scenario, run } = simulation;
    const prefix = run.targetResource || "cdn-cache";
    const resourceName = `${prefix}-${uuidv4().slice(0, 8)}`;
    
    run.affectedResources.push(`${run.targetNamespace}/${resourceName}`);
    run.metrics.push({
      name: "Unknown Terminations",
      before: 0,
      during: 1,
      after: 0,
      unit: "count",
    });

    const incident = incidentDetector.injectSimulatedIncident({
      title: `Unknown Crash: ${resourceName}`,
      description: scenario.productionBehavior,
      severity: scenario.severity,
      category: scenario.incidentCategory,
      resource: resourceName,
      resourceType: "pod",
      namespace: run.targetNamespace,
      autoHealable: scenario.autoHealable,
      suggestedAction: "Escalate with full diagnostics",
      productionBehavior: scenario.productionBehavior,
      metrics: { unknownTermination: true, signal: "SIGKILL" },
    });

    run.incidentId = incident.id;
    logger.warn({ resourceName, incidentId: incident.id }, "Unknown crash simulation injected - ESCALATION REQUIRED");
  }

  private async simulateMultiServiceFailure(simulation: ActiveSimulation) {
    const { scenario, run } = simulation;
    const targetServices = (scenario.parameters.targetServices as string[]) || ["redis", "postgres"];
    
    targetServices.forEach((svc) => {
      run.affectedResources.push(`${run.targetNamespace}/${svc}`);
    });
    
    run.metrics.push({
      name: "Failed Services",
      before: 0,
      during: targetServices.length,
      after: 0,
      unit: "count",
    });

    const incident = incidentDetector.injectSimulatedIncident({
      title: `Multi-Service Failure: Cascading Outage`,
      description: scenario.productionBehavior,
      severity: scenario.severity,
      category: scenario.incidentCategory,
      resource: targetServices.join(", "),
      resourceType: "service",
      namespace: run.targetNamespace,
      autoHealable: scenario.autoHealable,
      suggestedAction: "Raise critical incident, page on-call",
      productionBehavior: scenario.productionBehavior,
      metrics: { failedServicesCount: targetServices.length, cascading: true },
    });

    run.incidentId = incident.id;
    logger.error({ targetServices, incidentId: incident.id }, "Multi-service failure simulation injected - CRITICAL ESCALATION");
  }

  getStats() {
    const runs = Array.from(this.runs.values());
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recent = runs.filter((r) => new Date(r.startTime) >= last24h);

    return {
      totalRuns: runs.length,
      activeRuns: this.activeSimulations.size,
      last24h: {
        total: recent.length,
        completed: recent.filter((r) => r.status === "completed").length,
        failed: recent.filter((r) => r.status === "failed").length,
        cancelled: recent.filter((r) => r.status === "cancelled").length,
      },
    };
  }
}

export const simulationRunner = new SimulationRunner();
