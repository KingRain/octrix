import { Router, Request, Response } from "express";
import { prometheusService } from "../services/prometheus.service.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("metrics-routes");
const router = Router();

router.get("/nodes", async (_req: Request, res: Response) => {
  try {
    const metrics = await prometheusService.getNodeMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error({ error }, "Failed to get node metrics");
    res.status(500).json({ success: false, message: "Failed to get node metrics" });
  }
});

router.get("/pods", async (req: Request, res: Response) => {
  try {
    const namespace = req.query.namespace as string | undefined;
    const metrics = await prometheusService.getPodMetrics(namespace);
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error({ error }, "Failed to get pod metrics");
    res.status(500).json({ success: false, message: "Failed to get pod metrics" });
  }
});

router.get("/cluster", async (_req: Request, res: Response) => {
  try {
    const metrics = await prometheusService.getClusterMetrics();
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
    
    const result = await prometheusService.query(query);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, "Failed to execute Prometheus query");
    res.status(500).json({ success: false, message: "Failed to execute query" });
  }
});

router.get("/query_range", async (req: Request, res: Response) => {
  try {
    const { query, start, end, step } = req.query;
    
    if (!query || !start || !end || !step) {
      res.status(400).json({ 
        success: false, 
        message: "Required parameters: query, start, end, step" 
      });
      return;
    }
    
    const result = await prometheusService.queryRange(
      query as string,
      parseFloat(start as string),
      parseFloat(end as string),
      step as string
    );
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, "Failed to execute Prometheus range query");
    res.status(500).json({ success: false, message: "Failed to execute range query" });
  }
});

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const connected = await prometheusService.checkConnection();
    res.json({ 
      success: true, 
      data: { 
        connected,
        message: connected ? "Prometheus is reachable" : "Using mock data (Prometheus unavailable)"
      } 
    });
  } catch (error) {
    logger.error({ error }, "Failed to check Prometheus status");
    res.status(500).json({ success: false, message: "Failed to check status" });
  }
});

export default router;
