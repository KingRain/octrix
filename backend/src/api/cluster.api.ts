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
    const pods = await kubernetesService.getPods();
    const deletePromises = pods.map((pod) => 
      kubernetesService.deletePod(pod.namespace, pod.name)
    );
    
    await Promise.allSettled(deletePromises);
    
    const deleted = deletePromises.filter((_, index) => 
      pods[index].name
    ).length;
    
    res.json({ 
      success: true, 
      message: `Restarted ${deleted} pods`, 
      data: { deleted } 
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
