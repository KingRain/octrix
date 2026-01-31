import { Router, Request, Response } from "express";
import { healingService } from "../services/healing.service.js";
import { healingEngine } from "../healing/engine.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("healing-routes");
const router = Router();

router.get("/status", (_req: Request, res: Response) => {
  res.json({ 
    success: true, 
    data: { 
      enabled: healingEngine.enabled 
    } 
  });
});

router.get("/stats", (_req: Request, res: Response) => {
  const stats = healingService.getStats();
  res.json({ success: true, data: stats });
});

router.get("/activity", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const filter = req.query.filter as string || "all";
  const activity = healingService.getActivity(limit, filter);
  res.json({ success: true, data: activity });
});

router.post("/toggle", (req: Request, res: Response) => {
  const { enabled } = req.body;
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ success: false, message: "enabled must be a boolean" });
  }
  healingEngine.setEnabled(enabled);
  res.json({ success: true, data: { enabled: healingEngine.enabled } });
});

router.get("/rules", (_req: Request, res: Response) => {
  const rules = healingService.getRules();
  res.json({ success: true, data: rules });
});

router.get("/rules/:id", (req: Request, res: Response) => {
  const rule = healingService.getRule(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, message: "Rule not found" });
  }
  res.json({ success: true, data: rule });
});

router.post("/rules", (req: Request, res: Response) => {
  try {
    const rule = healingService.createRule(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    logger.error({ error }, "Failed to create rule");
    res.status(400).json({ success: false, message: "Failed to create rule" });
  }
});

router.put("/rules/:id", (req: Request, res: Response) => {
  const rule = healingService.updateRule(req.params.id, req.body);
  if (!rule) {
    return res.status(404).json({ success: false, message: "Rule not found" });
  }
  res.json({ success: true, data: rule });
});

router.delete("/rules/:id", (req: Request, res: Response) => {
  const deleted = healingService.deleteRule(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: "Rule not found" });
  }
  res.json({ success: true, message: "Rule deleted" });
});

router.post("/rules/:id/toggle", (req: Request, res: Response) => {
  const rule = healingService.toggleRule(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, message: "Rule not found" });
  }
  res.json({ success: true, data: rule });
});

router.get("/events", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const events = healingService.getEvents(limit);
  res.json({ success: true, data: events });
});

router.post("/rules/:id/execute", async (req: Request, res: Response) => {
  const rule = healingService.getRule(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, message: "Rule not found" });
  }

  const { targetResource, targetNamespace } = req.body;
  if (!targetResource || !targetNamespace) {
    return res.status(400).json({
      success: false,
      message: "targetResource and targetNamespace are required",
    });
  }

  try {
    const event = await healingService.executeAction(rule, targetResource, targetNamespace);
    res.json({ success: true, data: event });
  } catch (error) {
    logger.error({ error }, "Failed to execute healing action");
    res.status(500).json({ success: false, message: "Failed to execute action" });
  }
});

export default router;
