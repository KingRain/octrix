import { Router, Request, Response } from "express";
import { costService } from "../services/cost.service.js";
import { nodeUtilizationService } from "../services/node-utilization.service.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("cost-routes");
const router = Router();

// Get cost summary with metrics, issues, and trends
router.get("/summary", async (_req: Request, res: Response) => {
  try {
    const summary = await costService.getCostSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error({ error }, "Failed to get cost summary");
    res.status(500).json({ success: false, message: "Failed to get cost summary" });
  }
});

// Get cost metrics
router.get("/metrics", async (_req: Request, res: Response) => {
  try {
    const metrics = await costService.getCostMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error({ error }, "Failed to get cost metrics");
    res.status(500).json({ success: false, message: "Failed to get cost metrics" });
  }
});

// Get cost issues
router.get("/issues", async (req: Request, res: Response) => {
  try {
    const filter = req.query.filter as string | undefined;
    const issues = await costService.getCostIssues(filter);
    res.json({ success: true, data: issues });
  } catch (error) {
    logger.error({ error }, "Failed to get cost issues");
    res.status(500).json({ success: false, message: "Failed to get cost issues" });
  }
});

// Get efficiency data
router.get("/efficiency", async (_req: Request, res: Response) => {
  try {
    const efficiency = await costService.getEfficiencyData();
    res.json({ success: true, data: efficiency });
  } catch (error) {
    logger.error({ error }, "Failed to get efficiency data");
    res.status(500).json({ success: false, message: "Failed to get efficiency data" });
  }
});

// Update issue status
router.patch("/issues/:id", async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status || !["active", "optimized", "pending"].includes(status)) {
      res.status(400).json({ 
        success: false, 
        message: "Invalid status. Must be one of: active, optimized, pending" 
      });
      return;
    }
    
    const issue = costService.updateIssueStatus(req.params.id, status);
    if (!issue) {
      res.status(404).json({ success: false, message: "Issue not found" });
      return;
    }
    
    res.json({ success: true, data: issue });
  } catch (error) {
    logger.error({ error }, "Failed to update issue status");
    res.status(500).json({ success: false, message: "Failed to update issue status" });
  }
});

// Get node utilization data with cluster summary and insights
router.get("/node-utilization", async (_req: Request, res: Response) => {
  try {
    const data = await nodeUtilizationService.getNodeUtilizationData();
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, "Failed to get node utilization data");
    res.status(500).json({ success: false, message: "Failed to get node utilization data" });
  }
});

// Get cost configuration
router.get("/config", async (_req: Request, res: Response) => {
  try {
    const config = nodeUtilizationService.getCostConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error({ error }, "Failed to get cost config");
    res.status(500).json({ success: false, message: "Failed to get cost config" });
  }
});

// Update cost configuration
router.patch("/config", async (req: Request, res: Response) => {
  try {
    const { defaultNodeHourlyCost, nodeTypeCosts } = req.body;
    nodeUtilizationService.updateCostConfig({ defaultNodeHourlyCost, nodeTypeCosts });
    const config = nodeUtilizationService.getCostConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error({ error }, "Failed to update cost config");
    res.status(500).json({ success: false, message: "Failed to update cost config" });
  }
});

export default router;
