import { createChildLogger } from "../utils/logger.js";
import { kubernetesService } from "./kubernetes.service.js";
import { prometheusService } from "./prometheus.service.js";
import { incidentDetector } from "../incidents/detector.js";
import type { ClusterOverview, ServiceGroup, PodInfo } from "../types/index.js";

const logger = createChildLogger("overview-service");

export class OverviewService {
  async getClusterOverview(): Promise<ClusterOverview> {
    try {
      const [pods, services, podMetrics, clusterMetrics] = await Promise.all([
        kubernetesService.getPods(),
        kubernetesService.getServices(),
        prometheusService.getPodMetrics(),
        prometheusService.getClusterMetrics(),
      ]);

      const podMetricsMap = new Map(
        podMetrics.map((pm) => [`${pm.namespace}/${pm.podName}`, pm])
      );

      const serviceGroups = this.groupPodsByService(pods, services, podMetricsMap);

      let healthyPods = 0;
      let healingPods = 0;
      let failedPods = 0;

      serviceGroups.forEach((sg) => {
        healthyPods += sg.healthyCount;
        healingPods += sg.healingCount;
        failedPods += sg.failedCount;
      });

      return {
        connected: true,
        services: serviceGroups,
        totalPods: pods.length,
        healthyPods,
        healingPods,
        failedPods,
        totalCpu: clusterMetrics.totalCpuCores * 1000,
        totalMemory: clusterMetrics.totalMemoryBytes,
        usedCpu: clusterMetrics.usedCpuCores * 1000,
        usedMemory: clusterMetrics.usedMemoryBytes,
      };
    } catch (error) {
      logger.error({ error }, "Failed to get cluster overview");
      return this.getDisconnectedOverview();
    }
  }

  private groupPodsByService(
    pods: Awaited<ReturnType<typeof kubernetesService.getPods>>,
    services: Awaited<ReturnType<typeof kubernetesService.getServices>>,
    podMetricsMap: Map<string, Awaited<ReturnType<typeof prometheusService.getPodMetrics>>[number]>
  ): ServiceGroup[] {
    const serviceGroupMap = new Map<string, ServiceGroup>();

    const serviceSelectors = services.map((svc) => ({
      name: svc.name,
      namespace: svc.namespace,
      selector: svc.selector,
    }));

    pods.forEach((pod) => {
      let serviceName = this.findServiceForPod(pod, serviceSelectors);
      
      if (!serviceName) {
        serviceName = this.inferServiceName(pod.name, pod.labels);
      }

      const groupKey = `${pod.namespace}/${serviceName}`;
      const metrics = podMetricsMap.get(`${pod.namespace}/${pod.name}`);

      const podInfo: PodInfo = {
        id: pod.id,
        name: pod.name,
        status: this.mapPodStatus(pod, metrics),
        cpu: metrics?.cpuUsageCores ? metrics.cpuUsageCores * 1000 : 0,
        memory: metrics?.memoryUsageBytes || 0,
        restarts: pod.restarts,
      };

      if (!serviceGroupMap.has(groupKey)) {
        serviceGroupMap.set(groupKey, {
          name: serviceName,
          namespace: pod.namespace,
          pods: [],
          totalCpu: 0,
          totalMemory: 0,
          healthyCount: 0,
          healingCount: 0,
          failedCount: 0,
        });
      }

      const group = serviceGroupMap.get(groupKey)!;
      group.pods.push(podInfo);
      group.totalCpu += podInfo.cpu;
      group.totalMemory += podInfo.memory;

      if (podInfo.status === "healthy") {
        group.healthyCount++;
      } else if (podInfo.status === "healing") {
        group.healingCount++;
      } else if (podInfo.status === "failed") {
        group.failedCount++;
      }
    });

    return Array.from(serviceGroupMap.values())
      .filter((sg) => !this.isSystemService(sg.name, sg.namespace))
      .sort((a, b) => b.pods.length - a.pods.length);
  }

  private findServiceForPod(
    pod: Awaited<ReturnType<typeof kubernetesService.getPods>>[number],
    services: Array<{ name: string; namespace: string; selector: Record<string, string> }>
  ): string | null {
    for (const svc of services) {
      if (svc.namespace !== pod.namespace) continue;
      
      const matches = Object.entries(svc.selector).every(
        ([key, value]) => pod.labels[key] === value
      );
      
      if (matches && Object.keys(svc.selector).length > 0) {
        return svc.name;
      }
    }
    return null;
  }

  private inferServiceName(podName: string, labels: Record<string, string>): string {
    if (labels["app.kubernetes.io/name"]) {
      return labels["app.kubernetes.io/name"];
    }
    if (labels["app"]) {
      return labels["app"];
    }
    
    const parts = podName.split("-");
    if (parts.length >= 3) {
      return parts.slice(0, -2).join("-");
    }
    if (parts.length >= 2) {
      return parts.slice(0, -1).join("-");
    }
    return podName;
  }

  private mapPodStatus(
    pod: Awaited<ReturnType<typeof kubernetesService.getPods>>[number],
    metrics?: Awaited<ReturnType<typeof prometheusService.getPodMetrics>>[number]
  ): PodInfo["status"] {
    const activeIncidents = incidentDetector.getIncidents().filter(
      (i) => i.status !== "resolved" && i.resourceType === "pod"
    );
    
    const podIncident = activeIncidents.find(
      (i) => i.resource === pod.name || i.resource.includes(pod.name)
    );
    
    if (podIncident) {
      if (podIncident.status === "escalated" || podIncident.severity === "critical") {
        return "failed";
      }
      if (podIncident.status === "healing" || podIncident.status === "open") {
        return "healing";
      }
    }

    if (pod.status === "failed") {
      return "failed";
    }
    
    if (pod.status === "pending") {
      return "pending";
    }

    if (pod.status === "running") {
      if (pod.restarts > 3 || (metrics?.restartCount && metrics.restartCount > 3)) {
        return "healing";
      }

      const hasWaitingContainer = pod.containers.some((c) => c.status === "waiting");
      const hasTerminatedContainer = pod.containers.some((c) => c.status === "terminated");
      
      if (hasWaitingContainer || hasTerminatedContainer) {
        return "healing";
      }

      return "healthy";
    }

    return "unknown";
  }

  private isSystemService(name: string, namespace: string): boolean {
    const systemNamespaces = ["kube-system", "kube-public", "kube-node-lease", "monitoring"];
    if (systemNamespaces.includes(namespace)) {
      return true;
    }
    
    const systemPrefixes = [
      "coredns", 
      "etcd", 
      "kube-apiserver", 
      "kube-controller", 
      "kube-proxy", 
      "kube-scheduler",
      "prometheus",
      "alertmanager",
      "grafana",
      "metrics-server",
      "dashboard"
    ];
    return systemPrefixes.some((prefix) => name.toLowerCase().startsWith(prefix));
  }

  private getDisconnectedOverview(): ClusterOverview {
    return {
      connected: false,
      services: [],
      totalPods: 0,
      healthyPods: 0,
      healingPods: 0,
      failedPods: 0,
      totalCpu: 0,
      totalMemory: 0,
      usedCpu: 0,
      usedMemory: 0,
    };
  }
}

export const overviewService = new OverviewService();
