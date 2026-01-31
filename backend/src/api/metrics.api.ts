import { Router, Request, Response } from "express";
import { collectNodeMetrics } from "../metrics/node.metrics.js";
import { collectPodMetrics } from "../metrics/pod.metrics.js";
import { collectClusterMetrics } from "../metrics/cluster.metrics.js";
import { prometheusCollector } from "../metrics/prometheus.collector.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("metrics-api");
const router = Router();

router.get("/nodes", async (_req: Request, res: Response) => {
  try {
    const metrics = await collectNodeMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error({ error }, "Failed to get node metrics");
    res.status(500).json({ success: false, message: "Failed to get node metrics" });
  }
});

router.get("/pods", async (req: Request, res: Response) => {
  try {
    const namespace = req.query.namespace as string | undefined;
    const metrics = await collectPodMetrics(namespace);
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error({ error }, "Failed to get pod metrics");
    res.status(500).json({ success: false, message: "Failed to get pod metrics" });
  }
});

router.get("/cluster", async (_req: Request, res: Response) => {
  try {
    const metrics = await collectClusterMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error({ error }, "Failed to get cluster metrics");
    res.status(500).json({ success: false, message: "Failed to get cluster metrics" });
  }
});

router.get("/query", async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string;
    if (!query) {
      res.status(400).json({ success: false, message: "Query parameter required" });
      return;
    }
    
    const result = await prometheusCollector.query(query);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, "Failed to execute Prometheus query");
    res.status(500).json({ success: false, message: "Failed to execute query" });
  }
});

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const connected = await prometheusCollector.checkConnection();
    const status = prometheusCollector.getStatus();
    res.json({ 
      success: true, 
      data: { 
        ...status,
        message: connected ? "Prometheus is reachable" : "Using mock data (Prometheus unavailable)"
      } 
    });
  } catch (error) {
    logger.error({ error }, "Failed to check Prometheus status");
    res.status(500).json({ success: false, message: "Failed to check status" });
  }
});

export default router;
