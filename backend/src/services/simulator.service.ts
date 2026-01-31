import { v4 as uuidv4 } from "uuid";
import { createChildLogger } from "../utils/logger.js";
import { kubernetesService } from "./kubernetes.service.js";
import { incidentDetector } from "../incidents/detector.js";
import type { SimulationScenario, SimulationRun, ScenarioType, SimulationStatus, Pod } from "../types/index.js";

const logger = createChildLogger("simulator-service");

export interface SimulationConfig {
  targetNamespace: string;
  targetResource?: string;
  duration: number;
  intensity?: "low" | "medium" | "high";
  parameters: Record<string, unknown>;
}

interface ActiveSimulation {
  run: SimulationRun;
  scenario: SimulationScenario;
  config: SimulationConfig;
  timeoutId?: NodeJS.Timeout;
  cleanupFn?: () => Promise<void>;
}

export class SimulatorService {
  private scenarios: Map<string, SimulationScenario> = new Map();
  private runs: Map<string, SimulationRun> = new Map();
  private activeSimulations: Map<string, ActiveSimulation> = new Map();
  private servicePodCounts: Map<string, number> = new Map();
  private readonly MAX_PODS_PER_SERVICE = 6;

  private readonly simulationServiceMapping: Record<string, { serviceName: string; namespace: string }> = {
    "pod-failure": { serviceName: "streaming-service", namespace: "default" },
    "cpu-stress": { serviceName: "streaming-service", namespace: "default" },
    "memory-stress": { serviceName: "cdn-cache", namespace: "default" },
    "latency-injection": { serviceName: "streaming-service", namespace: "default" },
    "packet-loss": { serviceName: "cdn-cache", namespace: "default" },
    "disk-stress": { serviceName: "streaming-service", namespace: "default" },
    "network-partition": { serviceName: "cdn-cache", namespace: "default" },
  };

  constructor() {
    this.loadDefaultScenarios();
  }

  private loadDefaultScenarios() {
    const defaultScenarios: SimulationScenario[] = [
      {
        id: uuidv4(),
        name: "Pod Failure",
        description: "Simulate a pod crash by deleting a random pod in the target namespace",
        type: "pod-failure",
        parameters: {
          podSelector: "",
          gracePeriodSeconds: 0,
        },
        duration: 60,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: "Node Drain",
        description: "Simulate node maintenance by cordoning and draining a node",
        type: "node-failure",
        parameters: {
          nodeName: "",
          evictPods: true,
        },
        duration: 300,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: "CPU Stress Test",
        description: "Inject CPU stress into pods to simulate high load",
        type: "cpu-stress",
        parameters: {
          cpuLoad: 80,
          workers: 2,
        },
        duration: 120,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: "Memory Stress Test",
        description: "Inject memory pressure into pods to simulate memory leaks",
        type: "memory-stress",
        parameters: {
          memoryMB: 256,
          growthRate: 10,
        },
        duration: 120,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: "Network Latency",
        description: "Inject network latency to simulate slow network conditions",
        type: "latency-injection",
        parameters: {
          latencyMs: 200,
          jitterMs: 50,
          targetPort: 80,
        },
        duration: 180,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: "Packet Loss",
        description: "Simulate network packet loss",
        type: "packet-loss",
        parameters: {
          lossPercent: 10,
          targetPort: 80,
        },
        duration: 120,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: "Disk Stress",
        description: "Fill disk space to simulate disk pressure",
        type: "disk-stress",
        parameters: {
          fillPercent: 80,
          path: "/tmp",
        },
        duration: 60,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: "Network Partition",
        description: "Simulate network partition between services",
        type: "network-partition",
        parameters: {
          sourceService: "",
          targetService: "",
          direction: "both",
        },
        duration: 120,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: "Signal Overload",
        description: "Deploy a crash-looping backend and noisy clients to demonstrate signal overload (many symptoms for one root cause)",
        type: "signal-overload",
        parameters: {
          namespace: "demo",
          clientReplicas: 4,
        },
        duration: 300,
        createdAt: new Date().toISOString(),
      },
    ];

    defaultScenarios.forEach((s) => this.scenarios.set(s.id, s));
  }

  getScenarios(): SimulationScenario[] {
    return Array.from(this.scenarios.values());
  }

  getScenario(id: string): SimulationScenario | undefined {
    return this.scenarios.get(id);
  }

  createScenario(scenario: Omit<SimulationScenario, "id" | "createdAt">): SimulationScenario {
    const newScenario: SimulationScenario = {
      ...scenario,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };
    this.scenarios.set(newScenario.id, newScenario);
    logger.info({ scenarioId: newScenario.id, name: newScenario.name }, "Scenario created");
    return newScenario;
  }

  deleteScenario(id: string): boolean {
    const deleted = this.scenarios.delete(id);
    if (deleted) {
      logger.info({ scenarioId: id }, "Scenario deleted");
    }
    return deleted;
  }

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

  async startSimulation(scenarioId: string, config: SimulationConfig): Promise<SimulationRun> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    const run: SimulationRun = {
      id: uuidv4(),
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status: "pending",
      startTime: new Date().toISOString(),
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
        config,
      };

      await this.executeSimulation(activeSimulation);
      this.activeSimulations.set(run.id, activeSimulation);

      activeSimulation.timeoutId = setTimeout(async () => {
        await this.stopSimulation(run.id);
      }, config.duration * 1000);

      logger.info(
        { runId: run.id, scenarioName: scenario.name, duration: config.duration },
        "Simulation started"
      );

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

    logger.info({ runId, scenarioName: active.scenario.name }, "Simulation completed");

    return active.run;
  }

  async cancelSimulation(runId: string): Promise<SimulationRun | null> {
    const active = this.activeSimulations.get(runId);
    if (!active) {
      return null;
    }

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

  private async executeSimulation(simulation: ActiveSimulation) {
    const { scenario, config, run } = simulation;

    switch (scenario.type) {
      case "pod-failure":
        await this.executePodFailure(simulation);
        break;
      case "node-failure":
        await this.executeNodeFailure(simulation);
        break;
      case "cpu-stress":
        await this.executeCpuStress(simulation);
        break;
      case "memory-stress":
        await this.executeMemoryStress(simulation);
        break;
      case "latency-injection":
        await this.executeLatencyInjection(simulation);
        break;
      case "packet-loss":
        await this.executePacketLoss(simulation);
        break;
      case "disk-stress":
        await this.executeDiskStress(simulation);
        break;
      case "network-partition":
        await this.executeNetworkPartition(simulation);
        break;
      case "signal-overload":
        await this.executeSignalOverload(simulation);
        break;
      default:
        throw new Error(`Unknown scenario type: ${scenario.type}`);
    }
  }

  private async executePodFailure(simulation: ActiveSimulation) {
    const { config, run } = simulation;
    
    try {
      const pods = await kubernetesService.getPods(config.targetNamespace);
      
      if (pods.length === 0) {
        this.simulateLocalPodFailure(simulation);
        return;
      }

      const targetPod = config.targetResource
        ? pods.find((p) => p.name === config.targetResource)
        : pods[Math.floor(Math.random() * pods.length)];

      if (!targetPod) {
        this.simulateLocalPodFailure(simulation);
        return;
      }

      run.affectedResources.push(`${targetPod.namespace}/${targetPod.name}`);
      
      await kubernetesService.deletePod(targetPod.namespace, targetPod.name);
      
      run.metrics.push({
        name: "Pod Deleted",
        before: pods.length,
        during: pods.length - 1,
        after: pods.length,
        unit: "count",
      });

      logger.info({ pod: targetPod.name, namespace: targetPod.namespace }, "Pod failure simulated");
    } catch (error) {
      logger.warn({ error }, "K8s pod failure failed, using local simulation");
      this.simulateLocalPodFailure(simulation);
    }
  }

  private simulateLocalPodFailure(simulation: ActiveSimulation) {
    const { config, run } = simulation;
    const namespace = config.targetNamespace || "ott-platform";
    const serviceName = "streaming-service";
    const serviceKey = `${namespace}/${serviceName}`;

    const currentCount = this.servicePodCounts.get(serviceKey) || 0;
    if (currentCount >= this.MAX_PODS_PER_SERVICE) {
      logger.warn({ serviceKey, count: currentCount }, "Service at max capacity, skipping pod creation");
      return;
    }

    const suffix = uuidv4().slice(0, 5);
    const fakePodName = `${serviceName}-${suffix}`;

    run.affectedResources.push(`${namespace}/${fakePodName}`);
    run.metrics.push({
      name: "Simulated Pod Failure",
      before: 1,
      during: 0,
      after: 1,
      unit: "availability",
    });

    kubernetesService.createPod(namespace, fakePodName, { app: serviceName, simulated: "true" }, "nginx:latest", 100, 256);

    simulation.cleanupFn = async () => {
      try {
        await kubernetesService.deletePod(namespace, fakePodName);
        this.servicePodCounts.set(serviceKey, Math.max(0, (this.servicePodCounts.get(serviceKey) || 1) - 1));
        logger.info({ namespace, name: fakePodName }, "Real pod deleted");
      } catch (error) {
        logger.error({ error, namespace, name: fakePodName }, "Failed to delete real pod");
      }
    };

    incidentDetector.injectSimulatedIncident({
      title: `[SIMULATED] Pod Crash: ${fakePodName}`,
      description: `Simulated pod failure for testing auto-healing`,
      severity: "medium",
      category: "crash-loop",
      resource: fakePodName,
      resourceType: "pod",
      namespace,
      autoHealable: true,
      suggestedAction: "Restart the pod",
      productionBehavior: "Pod will be auto-restarted by Kubernetes",
      metrics: { restartCount: 5 },
    });

    logger.info({ fakePodName, namespace, serviceKey, count: currentCount + 1 }, "Real pod failure simulated");
  }

  private async executeNodeFailure(simulation: ActiveSimulation) {
    const { config, run } = simulation;
    
    try {
      const nodes = await kubernetesService.getNodes();
      const workerNodes = nodes.filter((n) => n.role === "worker");
      
      if (workerNodes.length === 0) {
        this.simulateLocalNodeFailure(simulation);
        return;
      }

      const targetNode = config.targetResource
        ? workerNodes.find((n) => n.name === config.targetResource)
        : workerNodes[Math.floor(Math.random() * workerNodes.length)];

      if (!targetNode) {
        this.simulateLocalNodeFailure(simulation);
        return;
      }

      run.affectedResources.push(targetNode.name);
      
      await kubernetesService.cordonNode(targetNode.name);

      simulation.cleanupFn = async () => {
        await kubernetesService.uncordonNode(targetNode.name);
        logger.info({ node: targetNode.name }, "Node uncordoned after simulation");
      };

      run.metrics.push({
        name: "Node Cordoned",
        before: 1,
        during: 0,
        after: 1,
        unit: "schedulable",
      });

      logger.info({ node: targetNode.name }, "Node failure simulated (cordoned)");
    } catch (error) {
      logger.warn({ error }, "K8s node failure failed, using local simulation");
      this.simulateLocalNodeFailure(simulation);
    }
  }

  private simulateLocalNodeFailure(simulation: ActiveSimulation) {
    const { run } = simulation;
    const fakeNodeName = `simulated-node-${uuidv4().slice(0, 8)}`;
    
    run.affectedResources.push(fakeNodeName);
    run.metrics.push({
      name: "Simulated Node Failure",
      before: 1,
      during: 0,
      after: 1,
      unit: "availability",
    });

    incidentDetector.injectSimulatedIncident({
      title: `[SIMULATED] Node Not Ready: ${fakeNodeName}`,
      description: `Simulated node failure for testing`,
      severity: "critical",
      category: "node-not-ready",
      resource: fakeNodeName,
      resourceType: "node",
      namespace: "cluster",
      autoHealable: false,
      suggestedAction: "Check node status and restart kubelet",
      productionBehavior: "Manual intervention required",
      metrics: { cpuUsage: 0, memoryUsage: 0 },
    });

    logger.info({ fakeNodeName }, "Local node failure simulated");
  }

  private async executeCpuStress(simulation: ActiveSimulation) {
    const { config, run, scenario } = simulation;
    const cpuLoad = (scenario.parameters.cpuLoad as number) || 80;
    const serviceMapping = this.simulationServiceMapping[scenario.type] || { serviceName: "streaming-service", namespace: "ott-platform" };
    const namespace = serviceMapping.namespace;
    const serviceName = serviceMapping.serviceName;
    const serviceKey = `${namespace}/${serviceName}`;

    const currentCount = this.servicePodCounts.get(serviceKey) || 0;
    if (currentCount >= this.MAX_PODS_PER_SERVICE) {
      logger.warn({ serviceKey, count: currentCount }, "Service at max capacity, skipping pod creation");
      return;
    }

    const suffix = uuidv4().slice(0, 5);
    const fakePodName = `${serviceName}-${suffix}`;
    run.affectedResources.push(`${namespace}/${fakePodName}`);
    run.metrics.push({
      name: "CPU Usage",
      before: 30,
      during: cpuLoad,
      after: 30,
      unit: "percent",
    });

    kubernetesService.createPod(namespace, fakePodName, { app: serviceName, simulated: "true" }, "nginx:latest", cpuLoad, 256);
    this.servicePodCounts.set(serviceKey, currentCount + 1);

    simulation.cleanupFn = async () => {
      try {
        await kubernetesService.deletePod(namespace, fakePodName);
        this.servicePodCounts.set(serviceKey, Math.max(0, (this.servicePodCounts.get(serviceKey) || 1) - 1));
        logger.info({ namespace, name: fakePodName }, "Real pod deleted");
      } catch (error) {
        logger.error({ error, namespace, name: fakePodName }, "Failed to delete real pod");
      }
    };

    incidentDetector.injectSimulatedIncident({
      title: `[SIMULATED] High CPU in ${namespace}`,
      description: `CPU stress test running at ${cpuLoad}% load`,
      severity: cpuLoad >= 90 ? "critical" : "medium",
      category: "high-cpu",
      resource: fakePodName,
      resourceType: "pod",
      namespace,
      autoHealable: true,
      suggestedAction: "Scale deployment or optimize application",
      productionBehavior: "Horizontal Pod Autoscaler may trigger",
      metrics: { cpuUsage: cpuLoad },
    });

    logger.info({ cpuLoad, namespace, serviceKey, count: currentCount + 1 }, "CPU stress simulated");
  }

  private async executeMemoryStress(simulation: ActiveSimulation) {
    const { config, run, scenario } = simulation;
    const memoryMB = (scenario.parameters.memoryMB as number) || 256;
    const serviceMapping = this.simulationServiceMapping[scenario.type] || { serviceName: "cdn-cache", namespace: "ott-platform" };
    const namespace = serviceMapping.namespace;
    const serviceName = serviceMapping.serviceName;
    const serviceKey = `${namespace}/${serviceName}`;

    const currentCount = this.servicePodCounts.get(serviceKey) || 0;
    if (currentCount >= this.MAX_PODS_PER_SERVICE) {
      logger.warn({ serviceKey, count: currentCount }, "Service at max capacity, skipping pod creation");
      return;
    }

    const memoryPercent = Math.min(95, 50 + (memoryMB / 10));
    const suffix = uuidv4().slice(0, 5);
    const fakePodName = `${serviceName}-${suffix}`;
    run.affectedResources.push(`${namespace}/${fakePodName}`);
    run.metrics.push({
      name: "Memory Usage",
      before: 512,
      during: 512 + memoryMB,
      after: 512,
      unit: "MB",
    });

    kubernetesService.createPod(namespace, fakePodName, { app: serviceName, simulated: "true" }, "nginx:latest", 50, memoryMB);
    this.servicePodCounts.set(serviceKey, currentCount + 1);

    simulation.cleanupFn = async () => {
      try {
        await kubernetesService.deletePod(namespace, fakePodName);
        this.servicePodCounts.set(serviceKey, Math.max(0, (this.servicePodCounts.get(serviceKey) || 1) - 1));
        logger.info({ namespace, name: fakePodName }, "Real pod deleted");
      } catch (error) {
        logger.error({ error, namespace, name: fakePodName }, "Failed to delete real pod");
      }
    };

    incidentDetector.injectSimulatedIncident({
      title: `[SIMULATED] High Memory in ${namespace}`,
      description: `Memory stress test allocating ${memoryMB}MB`,
      severity: memoryPercent >= 90 ? "critical" : "medium",
      category: "oom-killed",
      resource: fakePodName,
      resourceType: "pod",
      namespace,
      autoHealable: true,
      suggestedAction: "Increase memory limits or optimize application",
      productionBehavior: "Pods may be OOMKilled and restarted",
      metrics: { memoryUsage: memoryPercent },
    });

    logger.info({ memoryMB, namespace, serviceKey, count: currentCount + 1 }, "Memory stress simulated");
  }

  private async executeLatencyInjection(simulation: ActiveSimulation) {
    const { config, run, scenario } = simulation;
    const latencyMs = (scenario.parameters.latencyMs as number) || 200;
    const namespace = config.targetNamespace || "default";

    run.affectedResources.push(`${namespace}/network`);
    run.metrics.push({
      name: "Network Latency",
      before: 5,
      during: latencyMs,
      after: 5,
      unit: "ms",
    });

    incidentDetector.injectSimulatedIncident({
      title: `[SIMULATED] High Latency in ${namespace}`,
      description: `Network latency injected at ${latencyMs}ms`,
      severity: latencyMs >= 500 ? "high" : "medium",
      category: "high-cpu",
      resource: namespace,
      resourceType: "pod",
      namespace,
      autoHealable: true,
      suggestedAction: "Check network configuration or reduce load",
      productionBehavior: "Application response time increased",
      metrics: { latency: latencyMs },
    });

    logger.info({ latencyMs, namespace }, "Network latency simulated");
  }

  private async executePacketLoss(simulation: ActiveSimulation) {
    const { config, run, scenario } = simulation;
    const lossPercent = (scenario.parameters.lossPercent as number) || 10;
    const namespace = config.targetNamespace || "default";

    run.affectedResources.push(`${namespace}/network`);
    run.metrics.push({
      name: "Packet Loss",
      before: 0,
      during: lossPercent,
      after: 0,
      unit: "percent",
    });

    incidentDetector.injectSimulatedIncident({
      title: `[SIMULATED] Packet Loss in ${namespace}`,
      description: `Packet loss injected at ${lossPercent}%`,
      severity: lossPercent >= 20 ? "high" : "medium",
      category: "high-cpu",
      resource: namespace,
      resourceType: "pod",
      namespace,
      autoHealable: true,
      suggestedAction: "Check network connectivity and retry logic",
      productionBehavior: "Application may experience timeouts",
      metrics: { packetLoss: lossPercent },
    });

    logger.info({ lossPercent, namespace }, "Packet loss simulated");
  }

  private async executeDiskStress(simulation: ActiveSimulation) {
    const { config, run, scenario } = simulation;
    const fillPercent = (scenario.parameters.fillPercent as number) || 80;
    const namespace = config.targetNamespace || "default";
    const serviceKey = `${namespace}/sample-app`;

    const currentCount = this.servicePodCounts.get(serviceKey) || 0;
    if (currentCount >= this.MAX_PODS_PER_SERVICE) {
      logger.warn({ serviceKey, count: currentCount }, "Service at max capacity, skipping pod creation");
    }

    run.affectedResources.push(`${namespace}/disk`);
    run.metrics.push({
      name: "Disk Usage",
      before: 40,
      during: fillPercent,
      after: 40,
      unit: "percent",
    });

    if (fillPercent >= 90) {
      incidentDetector.injectSimulatedIncident({
        title: `[SIMULATED] Disk Pressure in ${namespace}`,
        description: `Disk usage at ${fillPercent}%`,
        severity: "high",
        category: "node-pressure",
        resource: namespace,
        resourceType: "node",
        namespace,
        autoHealable: false,
        suggestedAction: "Clean up disk space or resize volumes",
        productionBehavior: "Pods may fail to schedule",
        metrics: { diskUsage: fillPercent },
      });
    }

    logger.info({ fillPercent, namespace }, "Disk stress simulated");
  }

  private async executeNetworkPartition(simulation: ActiveSimulation) {
    const { config, run, scenario } = simulation;
    const sourceService = scenario.parameters.sourceService as string;
    const targetService = scenario.parameters.targetService as string;
    const namespace = config.targetNamespace || "default";

    run.affectedResources.push(`${sourceService} <-> ${targetService}`);
    run.metrics.push({
      name: "Network Connectivity",
      before: 100,
      during: 0,
      after: 100,
      unit: "percent",
    });

    incidentDetector.injectSimulatedIncident({
      title: `[SIMULATED] Network Partition in ${namespace}`,
      description: `Network partition between ${sourceService} and ${targetService}`,
      severity: "high",
      category: "high-cpu",
      resource: `${sourceService}-${targetService}`,
      resourceType: "pod",
      namespace,
      autoHealable: false,
      suggestedAction: "Check network policies and service mesh configuration",
      productionBehavior: "Services cannot communicate",
      metrics: { connectivity: 0 },
    });

    logger.info({ sourceService, targetService, namespace }, "Network partition simulated");
  }

  private async executeSignalOverload(simulation: ActiveSimulation) {
    const { scenario, run } = simulation;
    const namespace = (scenario.parameters.namespace as string) || "demo";
    const clientReplicas = (scenario.parameters.clientReplicas as number) || 4;

    try {
      // Create namespace if it doesn't exist
      await kubernetesService.createNamespace(namespace);
      
      // Deploy crash-looping backend
      await kubernetesService.createDeployment(namespace, "backend-crash", {
        replicas: 1,
        labels: { app: "backend-crash" },
        image: "busybox:1.36",
        command: ["/bin/sh", "-c"],
        args: ["while true; do echo '[backend] booting, will crash in 3s...'; sleep 3; echo '[backend] exiting now!'; exit 1; done"],
      });

      // Create service for backend
      await kubernetesService.createService(namespace, "backend-crash", {
        selector: { app: "backend-crash" },
        port: 8080,
        targetPort: 8080,
      });

      // Deploy noisy client that tries to connect to backend
      await kubernetesService.createDeployment(namespace, "client-stresser", {
        replicas: clientReplicas,
        labels: { app: "client-stresser" },
        image: "curlimages/curl:8.10.1",
        command: ["/bin/sh", "-c"],
        args: ["while true; do echo \"[client] $(date) -> hitting backend-crash.demo.svc.cluster.local:8080\"; curl -sS --max-time 2 http://backend-crash.demo.svc.cluster.local:8080 || echo '[client] request failed (connection/DNS/timeout).'; sleep 2; done"],
      });

      run.affectedResources.push(`${namespace}/backend-crash`, `${namespace}/client-stresser`);
      run.metrics.push({
        name: "Backend Restarts",
        before: 0,
        during: 25,
        after: 0,
        unit: "count",
      });
      run.metrics.push({
        name: "Client Errors",
        before: 0,
        during: clientReplicas * 10,
        after: 0,
        unit: "count",
      });

      simulation.cleanupFn = async () => {
        try {
          await kubernetesService.deleteDeployment(namespace, "client-stresser");
          await kubernetesService.deleteDeployment(namespace, "backend-crash");
          await kubernetesService.deleteService(namespace, "backend-crash");
          await kubernetesService.deleteNamespace(namespace);
          logger.info({ namespace }, "Signal overload cleanup completed");
        } catch (error) {
          logger.error({ error, namespace }, "Signal overload cleanup failed");
        }
      };

      // Inject multiple incidents to show signal overload
      incidentDetector.injectSimulatedIncident({
        title: `[SIGNAL OVERLOAD] Backend CrashLoopBackOff: backend-crash`,
        description: `Backend pod is crash-looping, causing cascading failures in ${clientReplicas} client pods`,
        severity: "critical",
        category: "crash-loop",
        resource: "backend-crash",
        resourceType: "pod",
        namespace,
        autoHealable: false,
        suggestedAction: "Fix the root cause in backend-crash pod",
        productionBehavior: "CrashLoopBackOff with exponential backoff",
        metrics: { restartCount: 25 },
      });

      // Inject client connection errors as separate incidents
      for (let i = 0; i < Math.min(clientReplicas, 3); i++) {
        incidentDetector.injectSimulatedIncident({
          title: `[SIGNAL OVERLOAD] Client connection errors: client-stresser-${i}`,
          description: `Client pod experiencing connection failures to backend-crash service`,
          severity: "medium",
          category: "unknown-crash",
          resource: `client-stresser-${i}`,
          resourceType: "pod",
          namespace,
          autoHealable: false,
          suggestedAction: "Check backend service availability",
          productionBehavior: "Connection refused / timeout errors",
          metrics: { errorCount: 10 },
        });
      }

      logger.info({ namespace, clientReplicas }, "Signal overload simulation started");
    } catch (error) {
      logger.error({ error, namespace }, "Failed to execute signal overload, using local simulation");
      this.simulateLocalSignalOverload(simulation);
    }
  }

  private simulateLocalSignalOverload(simulation: ActiveSimulation) {
    const { scenario, run } = simulation;
    const namespace = (scenario.parameters.namespace as string) || "demo";
    const clientReplicas = (scenario.parameters.clientReplicas as number) || 4;

    run.affectedResources.push(`${namespace}/backend-crash`, `${namespace}/client-stresser`);
    run.metrics.push({
      name: "Backend Restarts",
      before: 0,
      during: 25,
      after: 0,
      unit: "count",
    });

    // Inject the root cause incident
    incidentDetector.injectSimulatedIncident({
      title: `[SIGNAL OVERLOAD] Backend CrashLoopBackOff: backend-crash`,
      description: `Backend pod is crash-looping, causing cascading failures in ${clientReplicas} client pods`,
      severity: "critical",
      category: "crash-loop",
      resource: "backend-crash",
      resourceType: "pod",
      namespace,
      autoHealable: false,
      suggestedAction: "Fix the root cause in backend-crash pod",
      productionBehavior: "CrashLoopBackOff with exponential backoff",
      metrics: { restartCount: 25 },
    });

    // Inject client connection errors
    for (let i = 0; i < Math.min(clientReplicas, 3); i++) {
      incidentDetector.injectSimulatedIncident({
        title: `[SIGNAL OVERLOAD] Client connection errors: client-stresser-${i}`,
        description: `Client pod experiencing connection failures to backend-crash service`,
        severity: "medium",
        category: "unknown-crash",
        resource: `client-stresser-${i}`,
        resourceType: "pod",
        namespace,
        autoHealable: false,
        suggestedAction: "Check backend service availability",
        productionBehavior: "Connection refused / timeout errors",
        metrics: { errorCount: 10 },
      });
    }

    logger.info({ namespace, clientReplicas }, "Local signal overload simulation started");
  }

  getSimulationStats() {
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
      byScenarioType: this.getRunsByScenarioType(runs),
    };
  }

  private getRunsByScenarioType(runs: SimulationRun[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const run of runs) {
      const scenario = this.scenarios.get(run.scenarioId);
      if (scenario) {
        counts[scenario.type] = (counts[scenario.type] || 0) + 1;
      }
    }
    return counts;
  }
}

export const simulatorService = new SimulatorService();
