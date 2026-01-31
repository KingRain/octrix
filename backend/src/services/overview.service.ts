import { createChildLogger } from "../utils/logger.js";
import { kubernetesService } from "./kubernetes.service.js";
import { prometheusService } from "./prometheus.service.js";
import { kubectlTopService } from "./kubectl-top.service.js";
import { incidentDetector } from "../incidents/detector.js";
import type { ClusterOverview, ServiceGroup, PodInfo } from "../types/index.js";

const logger = createChildLogger("overview-service");

export class OverviewService {
  async getClusterOverview(): Promise<ClusterOverview> {
    try {
      const [pods, services, podMetrics, clusterMetrics, pvcs, volumeMetrics, kubectlTopData] = await Promise.all([
        kubernetesService.getPods(),
        kubernetesService.getServices(),
        prometheusService.getPodMetrics(),
        prometheusService.getClusterMetrics(),
        kubernetesService.getPVCs(),
        prometheusService.getVolumeMetrics(),
        kubectlTopService.getTopData(true), // Force refresh for real-time data
      ]);

      const podMetricsMap = new Map(
        podMetrics.map((pm) => [`${pm.namespace}/${pm.podName}`, pm])
      );

      // Create kubectl top metrics map for accurate real-time metrics
      const kubectlPodMetricsMap = new Map(
        kubectlTopData.pods.map((pm) => [`${pm.namespace}/${pm.name}`, pm])
      );

      const pvcMap = new Map(
        pvcs.map((pvc) => [`${pvc.metadata?.namespace}/${pvc.metadata?.name}`, pvc])
      );

      const volumeMetricsMap = new Map(
        volumeMetrics.map((vm) => [`${vm.namespace}/${vm.pvc}`, vm])
      );

      const serviceGroups = this.groupPodsByService(
        pods,
        services,
        podMetricsMap,
        pvcMap,
        volumeMetricsMap,
        kubectlPodMetricsMap
      );

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
    podMetricsMap: Map<string, Awaited<ReturnType<typeof prometheusService.getPodMetrics>>[number]>,
    pvcMap: Map<string, any>,
    volumeMetricsMap: Map<string, any>,
    kubectlPodMetricsMap: Map<string, { namespace: string; name: string; cpuCores: string; memoryBytes: string }>
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
      const kubectlMetrics = kubectlPodMetricsMap.get(`${pod.namespace}/${pod.name}`);

      const podPvcs: any[] = [];
      
      // Inject mock volumes for demo purposes if no volumes exist
      const explorerVolumes = pod.volumes || [];
      if (explorerVolumes.length === 0 || !explorerVolumes.some(v => v.persistentVolumeClaim)) {
        const name = pod.name.toLowerCase();
        if (name.includes("video") || name.includes("storage") || name.includes("transcoder")) {
          explorerVolumes.push({
            name: "video-storage-demo",
            persistentVolumeClaim: { claimName: "pvc-video-storage" }
          });
        } else if (name.includes("user") || name.includes("db") || name.includes("postgres")) {
          explorerVolumes.push({
            name: "user-data-demo",
            persistentVolumeClaim: { claimName: "pvc-user-data" }
          });
        } else if (name.includes("cache") || name.includes("redis")) {
          explorerVolumes.push({
            name: "cache-demo",
            persistentVolumeClaim: { claimName: "pvc-cache" }
          });
        }
      }

      explorerVolumes.forEach((vol) => {
        if (vol.persistentVolumeClaim) {
          const claimName = vol.persistentVolumeClaim.claimName;
          const pvc = pvcMap.get(`${pod.namespace}/${claimName}`);
          const metrics = volumeMetricsMap.get(`${pod.namespace}/${claimName}`);

          if (pvc) {
            const used = metrics?.usedBytes || 0;
            const capacity = metrics?.capacityBytes || 1;
            const usagePercent = (used / capacity) * 100;

            podPvcs.push({
              name: claimName,
              status: pvc.status?.phase || "Unknown",
              capacityBytes: capacity,
              usedBytes: used,
              usagePercent,
              health: usagePercent > 90 ? "critical" : usagePercent > 70 ? "warning" : "healthy",
            });
          }
        }
      });

      const pvcHealth = podPvcs.length === 0 ? "none" : 
        podPvcs.some(p => p.health === "critical") ? "critical" :
        podPvcs.some(p => p.health === "warning") ? "warning" : "healthy";

      // Use kubectl top metrics as primary source (most accurate real-time data)
      // Fall back to Prometheus metrics, then to default values
      const kubectlCpu = kubectlMetrics ? kubectlTopService.parseCpuToMillicores(kubectlMetrics.cpuCores) : null;
      const kubectlMemory = kubectlMetrics ? kubectlTopService.parseMemoryToBytes(kubectlMetrics.memoryBytes) : null;

      const podInfo: PodInfo = {
        id: pod.id,
        name: pod.name,
        nodeName: pod.nodeName,
        status: this.mapPodStatus(pod, metrics),
        // Priority: kubectl top > Prometheus > default (use !== null to allow 0 values)
        cpu: kubectlCpu !== null ? kubectlCpu : (metrics?.cpuUsageCores !== undefined ? metrics.cpuUsageCores * 1000 : 0),
        memory: kubectlMemory !== null ? kubectlMemory : (metrics?.memoryUsageBytes !== undefined ? metrics.memoryUsageBytes : 0),
        restarts: pod.restarts,
        pvcHealth,
        pvcs: podPvcs,
        timeToOomSeconds: metrics?.timeToOomSeconds,
        memoryGrowthRateBytesPerSecond: metrics?.memoryGrowthRateBytesPerSecond,
        cpuLimit: metrics?.cpuLimitCores ? metrics.cpuLimitCores * 1000 : 0,
        memoryLimit: metrics?.memoryLimitBytes || 0,
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
