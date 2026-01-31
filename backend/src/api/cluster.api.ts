import { Router, Request, Response } from "express";
import { kubernetesService } from "../services/kubernetes.service.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("cluster-api");
const router = Router();

router.get("/nodes", async (_req: Request, res: Response) => {
  try {
    const { collectNodeMetrics } = await import("../metrics/node.metrics.js");
    const metrics = await collectNodeMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error({ error }, "Failed to get nodes");
    res.status(500).json({ success: false, message: "Failed to get nodes" });
  }
});

router.get("/pods", async (req: Request, res: Response) => {
  try {
    const { collectPodMetrics } = await import("../metrics/pod.metrics.js");
    const namespace = req.query.namespace as string | undefined;
    const metrics = await collectPodMetrics(namespace);
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error({ error }, "Failed to get pods");
    res.status(500).json({ success: false, message: "Failed to get pods" });
  }
});

router.post("/pods/restart-all", async (_req: Request, res: Response) => {
  try {
    const { kubernetesService } = await import("../services/kubernetes.service.js");
    
    // Delete all existing pods
    const pods = await kubernetesService.getPods();
    const deletePromises = pods.map((pod) => 
      kubernetesService.deletePod(pod.namespace, pod.name)
    );
    
    await Promise.allSettled(deletePromises);
    
    const deleted = deletePromises.filter((_, index) => 
      pods[index].name
    ).length;
    
    // Spawn new pods with simulated CPU activity for all categories
    const categories = [
      { serviceName: "streaming-service", namespace: "ott-platform", cpuUsage: 80, memoryUsage: 256 },
      { serviceName: "cdn-cache", namespace: "ott-platform", cpuUsage: 50, memoryUsage: 128 },
      { serviceName: "authentication", namespace: "ott-platform", cpuUsage: 60, memoryUsage: 200 },
      { serviceName: "notifications", namespace: "ott-platform", cpuUsage: 40, memoryUsage: 150 },
      { serviceName: "video-transcoder", namespace: "ott-platform", cpuUsage: 90, memoryUsage: 512 },
      { serviceName: "recommendation-engine", namespace: "ott-platform", cpuUsage: 70, memoryUsage: 384 },
    ];
    
    const podsToCreate = 15; // Create 15 pods total
    const podsPerCategory = Math.ceil(podsToCreate / categories.length);
    
    for (const category of categories) {
      for (let i = 0; i < podsPerCategory; i++) {
        const suffix = Math.random().toString(36).substring(2, 8);
        const podName = `${category.serviceName}-${suffix}`;
        
        try {
          await kubernetesService.createPod(
            category.namespace,
            podName,
            { app: category.serviceName, simulated: "true" },
            "nginx:latest",
            category.cpuUsage,
            category.memoryUsage
          );
        } catch (error) {
          logger.error({ error, podName, category }, "Failed to create pod");
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `Restarted ${deleted} pods and spawned ${categories.length * podsPerCategory} new pods`, 
      data: { deleted, created: categories.length * podsPerCategory } 
    });
  } catch (error) {
    logger.error({ error }, "Failed to restart all pods");
    res.status(500).json({ success: false, message: "Failed to restart all pods" });
  }
});

router.get("/overview", async (_req: Request, res: Response) => {
  try {
    const { collectClusterMetrics } = await import("../metrics/cluster.metrics.js");
    const { incidentDetector } = await import("../incidents/detector.js");
    const { escalationManager } = await import("../escalation/escalation.manager.js");
    
    const clusterMetrics = await collectClusterMetrics();
    const incidentStats = incidentDetector.getStats();
    const escalationStats = escalationManager.getStats();

    res.json({ 
      success: true, 
      data: {
        cluster: clusterMetrics,
        incidents: incidentStats,
        escalations: escalationStats,
        automationFrozen: escalationManager.isAutomationFrozen(),
      }
    });
  } catch (error) {
    logger.error({ error }, "Failed to get cluster overview");
    res.status(500).json({ success: false, message: "Failed to get cluster overview" });
  }
});

router.get("/health", async (_req: Request, res: Response) => {
  try {
    const { prometheusCollector } = await import("../metrics/prometheus.collector.js");
    const connected = await prometheusCollector.checkConnection();
    
    res.json({ 
      success: true, 
      data: {
        status: "ok",
        prometheusConnected: connected,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    logger.error({ error }, "Failed to get health status");
    res.status(500).json({ success: false, message: "Failed to get health status" });
  }
});

export default router;
