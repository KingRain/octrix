import * as k8s from "@kubernetes/client-node";
import { createChildLogger } from "../utils/logger.js";
import type { Node, Pod, Service, Namespace } from "../types/index.js";

const logger = createChildLogger("kubernetes-service");

export class KubernetesService {
  private kc: k8s.KubeConfig;
  private coreApi: k8s.CoreV1Api;
  private appsApi: k8s.AppsV1Api;
  private mockPods: Map<string, Pod> = new Map();

  constructor() {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();
    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
  }

  async getNodes(): Promise<Node[]> {
    try {
      const response = await this.coreApi.listNode();
      return response.body.items.map((node) => this.mapNode(node));
    } catch (error) {
      logger.error({ error }, "Failed to get nodes");
      throw error;
    }
  }

  async getPods(namespace?: string): Promise<Pod[]> {
    try {
      const response = namespace
        ? await this.coreApi.listNamespacedPod(namespace)
        : await this.coreApi.listPodForAllNamespaces();
      const realPods = response.body.items.map((pod) => this.mapPod(pod));
      
      const mockPods = Array.from(this.mockPods.values());
      if (namespace) {
        return [...realPods, ...mockPods.filter((p) => p.namespace === namespace)];
      }
      return [...realPods, ...mockPods];
    } catch (error) {
      logger.error({ error, namespace }, "Failed to get pods");
      throw error;
    }
  }

  async getServices(namespace?: string): Promise<Service[]> {
    try {
      const response = namespace
        ? await this.coreApi.listNamespacedService(namespace)
        : await this.coreApi.listServiceForAllNamespaces();
      return response.body.items.map((svc) => this.mapService(svc));
    } catch (error) {
      logger.error({ error, namespace }, "Failed to get services");
      throw error;
    }
  }

  async getPVCs(namespace?: string): Promise<k8s.V1PersistentVolumeClaim[]> {
    try {
      const response = await this.coreApi.listPersistentVolumeClaimForAllNamespaces();
      const realPvcs = response.body.items;
      
      const mockPvcs: k8s.V1PersistentVolumeClaim[] = [
        {
          metadata: { name: "pvc-video-storage", namespace: "default" },
          status: { phase: "Bound" }
        },
        {
          metadata: { name: "pvc-user-data", namespace: "default" },
          status: { phase: "Bound" }
        },
        {
          metadata: { name: "pvc-cache", namespace: "default" },
          status: { phase: "Bound" }
        }
      ] as any;

      const allPvcs = [...realPvcs, ...mockPvcs];
      if (namespace) {
        return allPvcs.filter(p => p.metadata?.namespace === namespace);
      }
      return allPvcs;
    } catch (error) {
      logger.error({ error, namespace }, "Failed to get PVCs");
      const mockPvcs: k8s.V1PersistentVolumeClaim[] = [
        {
          metadata: { name: "pvc-video-storage", namespace: "default" },
          status: { phase: "Bound" }
        },
        {
          metadata: { name: "pvc-user-data", namespace: "default" },
          status: { phase: "Bound" }
        },
        {
          metadata: { name: "pvc-cache", namespace: "default" },
          status: { phase: "Bound" }
        }
      ] as any;
      return namespace ? mockPvcs.filter(p => p.metadata?.namespace === namespace) : mockPvcs;
    }
  }

  async getNamespaces(): Promise<Namespace[]> {
    try {
      const response = await this.coreApi.listNamespace();
      return response.body.items.map((ns) => this.mapNamespace(ns));
    } catch (error) {
      logger.error({ error }, "Failed to get namespaces");
      throw error;
    }
  }

  async getPodEvents(namespace: string, podName: string): Promise<Array<{
    type: string;
    reason: string;
    message: string;
    timestamp: string;
  }>> {
    try {
      const response = await this.coreApi.listNamespacedEvent(namespace);
      const events = response.body.items
        .filter((event) => event.involvedObject?.name === podName)
        .map((event) => ({
          type: event.type || "Normal",
          reason: event.reason || "Unknown",
          message: event.message || "",
          timestamp: (event.lastTimestamp || event.eventTime || new Date().toISOString()) as string,
        }));
      return events;
    } catch (error) {
      logger.error({ error, namespace, podName }, "Failed to get pod events");
      return [];
    }
  }

  async getAllEvents(namespace?: string): Promise<Array<{
    type: string;
    reason: string;
    message: string;
    timestamp: string;
    involvedObject: {
      kind: string;
      name: string;
      namespace: string;
    };
  }>> {
    try {
      const response = namespace
        ? await this.coreApi.listNamespacedEvent(namespace)
        : await this.coreApi.listEventForAllNamespaces();
      
      return response.body.items.map((event) => ({
        type: event.type || "Normal",
        reason: event.reason || "Unknown",
        message: event.message || "",
        timestamp: (event.lastTimestamp || event.eventTime || new Date().toISOString()) as string,
        involvedObject: {
          kind: event.involvedObject?.kind || "Unknown",
          name: event.involvedObject?.name || "Unknown",
          namespace: event.involvedObject?.namespace || namespace || "default",
        },
      }));
    } catch (error) {
      logger.error({ error, namespace }, "Failed to get all events");
      return [];
    }
  }

  async getPodLogs(namespace: string, podName: string, tailLines: number = 100): Promise<string> {
    try {
      const response = await this.coreApi.readNamespacedPodLog(
        podName,
        namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        tailLines
      );
      return response.body || "";
    } catch (error) {
      logger.error({ error, namespace, podName }, "Failed to get pod logs");
      return "";
    }
  }

  async getPodStatus(namespace: string, podName: string): Promise<{
    phase: string;
    conditions: Array<{ type: string; status: string; reason?: string; message?: string }>;
    containerStatuses: Array<{
      name: string;
      ready: boolean;
      restartCount: number;
      state: string;
      stateReason?: string;
      stateMessage?: string;
    }>;
  } | null> {
    try {
      const response = await this.coreApi.readNamespacedPodStatus(podName, namespace);
      const status = response.body.status;
      
      return {
        phase: status?.phase || "Unknown",
        conditions: (status?.conditions || []).map((c) => ({
          type: c.type || "",
          status: c.status || "Unknown",
          reason: c.reason,
          message: c.message,
        })),
        containerStatuses: (status?.containerStatuses || []).map((cs) => {
          let state = "unknown";
          let stateReason: string | undefined;
          let stateMessage: string | undefined;
          
          if (cs.state?.running) {
            state = "running";
          } else if (cs.state?.waiting) {
            state = "waiting";
            stateReason = cs.state.waiting.reason;
            stateMessage = cs.state.waiting.message;
          } else if (cs.state?.terminated) {
            state = "terminated";
            stateReason = cs.state.terminated.reason;
            stateMessage = cs.state.terminated.message;
          }
          
          return {
            name: cs.name || "",
            ready: cs.ready || false,
            restartCount: cs.restartCount || 0,
            state,
            stateReason,
            stateMessage,
          };
        }),
      };
    } catch (error) {
      logger.error({ error, namespace, podName }, "Failed to get pod status");
      return null;
    }
  }

  async deletePod(namespace: string, name: string): Promise<void> {
    const mockKey = `${namespace}/${name}`;
    if (this.mockPods.has(mockKey)) {
      this.mockPods.delete(mockKey);
      logger.info({ namespace, name }, "Mock pod deleted");
      return;
    }

    try {
      await this.coreApi.deleteNamespacedPod(name, namespace);
      logger.info({ namespace, name }, "Pod deleted");
    } catch (error) {
      logger.error({ error, namespace, name }, "Failed to delete pod");
      throw error;
    }
  }

  addMockPod(pod: Pod): void {
    const key = `${pod.namespace}/${pod.name}`;
    this.mockPods.set(key, pod);
    logger.info({ name: pod.name, namespace: pod.namespace }, "Mock pod added");
  }

  removeMockPod(namespace: string, name: string): void {
    const key = `${namespace}/${name}`;
    this.mockPods.delete(key);
    logger.info({ namespace, name }, "Mock pod removed");
  }

  clearMockPods(): void {
    this.mockPods.clear();
    logger.info("All mock pods cleared");
  }

  async createPod(namespace: string, name: string, labels: Record<string, string>, image: string = "nginx:latest", cpuUsage?: number, memoryUsage?: number): Promise<string> {
    try {
      const pod: k8s.V1Pod = {
        metadata: {
          name,
          namespace,
          labels,
        },
        spec: {
          containers: [
            {
              name: "main",
              image,
              imagePullPolicy: "IfNotPresent",
            },
          ],
          restartPolicy: "Always",
        },
      };

      const response = await this.coreApi.createNamespacedPod(namespace, pod);
      logger.info({ namespace, name }, "Pod created");
      
      // Add to mock pods with simulated metrics if provided
      if (cpuUsage !== undefined || memoryUsage !== undefined) {
        const mockPod: Pod = {
          id: `${namespace}/${name}`,
          name,
          namespace,
          status: "running",
          phase: "Running",
          nodeName: "node-1",
          containers: [
            {
              name: "main",
              image,
              status: "running",
              ready: true,
              restartCount: 0,
              cpuUsage: cpuUsage || 0,
              memoryUsage: memoryUsage || 0,
              ports: [],
            },
          ],
          restarts: 0,
          cpuUsage: cpuUsage || 0,
          memoryUsage: memoryUsage || 0,
          createdAt: new Date().toISOString(),
          labels,
          annotations: {},
          ownerReferences: [],
          ip: `10.244.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 255)}`,
          volumes: [
            {
              name: "video-data",
              persistentVolumeClaim: { claimName: "pvc-video-storage" }
            }
          ],
        };
        this.addMockPod(mockPod);
      }
      
      return response.body.metadata?.uid || "";
    } catch (error) {
      logger.error({ error, namespace, name }, "Failed to create pod");
      throw error;
    }
  }

  async scaleDeployment(
    namespace: string,
    name: string,
    replicas: number
  ): Promise<void> {
    try {
      await this.appsApi.patchNamespacedDeploymentScale(
        name,
        namespace,
        { spec: { replicas } },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { "Content-Type": "application/strategic-merge-patch+json" } }
      );
      logger.info({ namespace, name, replicas }, "Deployment scaled");
    } catch (error) {
      logger.error({ error, namespace, name, replicas }, "Failed to scale deployment");
      throw error;
    }
  }

  async createNamespace(name: string): Promise<void> {
    try {
      const ns: k8s.V1Namespace = {
        metadata: { name },
      };
      await this.coreApi.createNamespace(ns);
      logger.info({ name }, "Namespace created");
    } catch (error: any) {
      if (error?.response?.statusCode === 409) {
        logger.info({ name }, "Namespace already exists");
        return;
      }
      logger.error({ error, name }, "Failed to create namespace");
      throw error;
    }
  }

  async deleteNamespace(name: string): Promise<void> {
    try {
      await this.coreApi.deleteNamespace(name);
      logger.info({ name }, "Namespace deleted");
    } catch (error) {
      logger.error({ error, name }, "Failed to delete namespace");
      throw error;
    }
  }

  async createDeployment(
    namespace: string,
    name: string,
    config: {
      replicas: number;
      labels: Record<string, string>;
      image: string;
      command?: string[];
      args?: string[];
    }
  ): Promise<void> {
    try {
      const deployment: k8s.V1Deployment = {
        metadata: {
          name,
          namespace,
        },
        spec: {
          replicas: config.replicas,
          selector: {
            matchLabels: config.labels,
          },
          template: {
            metadata: {
              labels: config.labels,
            },
            spec: {
              containers: [
                {
                  name: "main",
                  image: config.image,
                  command: config.command,
                  args: config.args,
                },
              ],
            },
          },
        },
      };
      await this.appsApi.createNamespacedDeployment(namespace, deployment);
      logger.info({ namespace, name }, "Deployment created");
    } catch (error) {
      logger.error({ error, namespace, name }, "Failed to create deployment");
      throw error;
    }
  }

  async deleteDeployment(namespace: string, name: string): Promise<void> {
    try {
      await this.appsApi.deleteNamespacedDeployment(name, namespace);
      logger.info({ namespace, name }, "Deployment deleted");
    } catch (error) {
      logger.error({ error, namespace, name }, "Failed to delete deployment");
      throw error;
    }
  }

  async createService(
    namespace: string,
    name: string,
    config: {
      selector: Record<string, string>;
      port: number;
      targetPort: number;
    }
  ): Promise<void> {
    try {
      const service: k8s.V1Service = {
        metadata: {
          name,
          namespace,
        },
        spec: {
          selector: config.selector,
          ports: [
            {
              port: config.port,
              targetPort: config.targetPort,
            },
          ],
        },
      };
      await this.coreApi.createNamespacedService(namespace, service);
      logger.info({ namespace, name }, "Service created");
    } catch (error) {
      logger.error({ error, namespace, name }, "Failed to create service");
      throw error;
    }
  }

  async deleteService(namespace: string, name: string): Promise<void> {
    try {
      await this.coreApi.deleteNamespacedService(name, namespace);
      logger.info({ namespace, name }, "Service deleted");
    } catch (error) {
      logger.error({ error, namespace, name }, "Failed to delete service");
      throw error;
    }
  }

  async cordonNode(name: string): Promise<void> {
    try {
      await this.coreApi.patchNode(
        name,
        { spec: { unschedulable: true } },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { "Content-Type": "application/strategic-merge-patch+json" } }
      );
      logger.info({ name }, "Node cordoned");
    } catch (error) {
      logger.error({ error, name }, "Failed to cordon node");
      throw error;
    }
  }

  async uncordonNode(name: string): Promise<void> {
    try {
      await this.coreApi.patchNode(
        name,
        { spec: { unschedulable: false } },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { "Content-Type": "application/strategic-merge-patch+json" } }
      );
      logger.info({ name }, "Node uncordoned");
    } catch (error) {
      logger.error({ error, name }, "Failed to uncordon node");
      throw error;
    }
  }

  private mapNode(node: k8s.V1Node): Node {
    const status = node.status;
    const readyCondition = status?.conditions?.find((c) => c.type === "Ready");

    return {
      id: node.metadata?.uid || "",
      name: node.metadata?.name || "",
      status: readyCondition?.status === "True" ? "ready" : "not-ready",
      role: node.metadata?.labels?.["node-role.kubernetes.io/control-plane"] !== undefined
        ? "control-plane"
        : "worker",
      cpuCapacity: this.parseCpu(status?.capacity?.cpu || "0"),
      cpuUsage: 0,
      memoryCapacity: this.parseMemory(status?.capacity?.memory || "0"),
      memoryUsage: 0,
      podCount: 0,
      conditions: (status?.conditions || []).map((c) => ({
        type: c.type || "",
        status: c.status as "True" | "False" | "Unknown",
        reason: c.reason || "",
        message: c.message || "",
        lastTransitionTime: c.lastTransitionTime?.toISOString() || "",
      })),
      labels: node.metadata?.labels || {},
      taints: (node.spec?.taints || []).map((t) => ({
        key: t.key || "",
        value: t.value || "",
        effect: t.effect as "NoSchedule" | "PreferNoSchedule" | "NoExecute",
      })),
      createdAt: node.metadata?.creationTimestamp?.toISOString() || "",
      ip: status?.addresses?.find((a) => a.type === "InternalIP")?.address || "",
    };
  }

  private mapPod(pod: k8s.V1Pod): Pod {
    const status = pod.status;

    return {
      id: pod.metadata?.uid || "",
      name: pod.metadata?.name || "",
      namespace: pod.metadata?.namespace || "",
      status: this.mapPodStatus(status?.phase),
      phase: (status?.phase || "Unknown") as Pod["phase"],
      nodeName: pod.spec?.nodeName || "",
      containers: (pod.spec?.containers || []).map((c, idx) => {
        const containerStatus = status?.containerStatuses?.[idx];
        return {
          name: c.name,
          image: c.image || "",
          status: containerStatus?.state?.running
            ? "running"
            : containerStatus?.state?.waiting
            ? "waiting"
            : "terminated",
          ready: containerStatus?.ready || false,
          restartCount: containerStatus?.restartCount || 0,
          cpuUsage: 0,
          memoryUsage: 0,
          ports: (c.ports || []).map((p) => ({
            name: p.name || "",
            containerPort: p.containerPort,
            protocol: (p.protocol || "TCP") as "TCP" | "UDP",
          })),
        };
      }),
      restarts: (status?.containerStatuses || []).reduce(
        (sum, c) => sum + (c.restartCount || 0),
        0
      ),
      cpuUsage: 0,
      memoryUsage: 0,
      createdAt: pod.metadata?.creationTimestamp?.toISOString() || "",
      labels: pod.metadata?.labels || {},
      annotations: pod.metadata?.annotations || {},
      ownerReferences: (pod.metadata?.ownerReferences || []).map((o) => ({
        kind: o.kind,
        name: o.name,
        uid: o.uid,
      })),
      ip: status?.podIP || "",
      volumes: (pod.spec?.volumes || []).map((v) => ({
        name: v.name,
        persistentVolumeClaim: v.persistentVolumeClaim ? {
          claimName: v.persistentVolumeClaim.claimName,
        } : undefined,
      })),
    };
  }

  private mapService(svc: k8s.V1Service): Service {
    return {
      id: svc.metadata?.uid || "",
      name: svc.metadata?.name || "",
      namespace: svc.metadata?.namespace || "",
      type: (svc.spec?.type || "ClusterIP") as Service["type"],
      clusterIP: svc.spec?.clusterIP || "",
      externalIP: svc.status?.loadBalancer?.ingress?.[0]?.ip,
      ports: (svc.spec?.ports || []).map((p) => ({
        name: p.name || "",
        port: p.port,
        targetPort: typeof p.targetPort === "number" ? p.targetPort : parseInt(p.targetPort?.toString() || "0", 10),
        nodePort: p.nodePort,
        protocol: (p.protocol || "TCP") as "TCP" | "UDP",
      })),
      selector: svc.spec?.selector || {},
      endpoints: [],
      createdAt: svc.metadata?.creationTimestamp?.toISOString() || "",
    };
  }

  private mapNamespace(ns: k8s.V1Namespace): Namespace {
    return {
      id: ns.metadata?.uid || "",
      name: ns.metadata?.name || "",
      status: (ns.status?.phase || "Active") as "Active" | "Terminating",
      labels: ns.metadata?.labels || {},
      createdAt: ns.metadata?.creationTimestamp?.toISOString() || "",
      podCount: 0,
      serviceCount: 0,
    };
  }

  private mapPodStatus(phase?: string): Pod["status"] {
    switch (phase) {
      case "Running":
        return "running";
      case "Pending":
        return "pending";
      case "Succeeded":
        return "succeeded";
      case "Failed":
        return "failed";
      default:
        return "unknown";
    }
  }

  private parseCpu(cpu: string): number {
    if (cpu.endsWith("m")) {
      return parseInt(cpu.slice(0, -1), 10);
    }
    return parseInt(cpu, 10) * 1000;
  }

  private parseMemory(memory: string): number {
    const units: Record<string, number> = {
      Ki: 1024,
      Mi: 1024 * 1024,
      Gi: 1024 * 1024 * 1024,
      K: 1000,
      M: 1000 * 1000,
      G: 1000 * 1000 * 1000,
    };

    for (const [unit, multiplier] of Object.entries(units)) {
      if (memory.endsWith(unit)) {
        return parseInt(memory.slice(0, -unit.length), 10) * multiplier;
      }
    }
    return parseInt(memory, 10);
  }
}

export const kubernetesService = new KubernetesService();
