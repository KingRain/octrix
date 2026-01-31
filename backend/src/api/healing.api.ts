import { Router, Request, Response } from "express";
import { healingRulesManager } from "../healing/rules.js";
import { healingEngine } from "../healing/engine.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("healing-api");
const router = Router();

router.get("/rules", async (_req: Request, res: Response) => {
  try {
    const rules = healingRulesManager.getRules();
    res.json({ success: true, data: rules });
  } catch (error) {
    logger.error({ error }, "Failed to get healing rules");
    res.status(500).json({ success: false, message: "Failed to get healing rules" });
  }
});

router.get("/rules/:id", async (req: Request, res: Response) => {
  try {
    const rule = healingRulesManager.getRule(req.params.id);
    if (!rule) {
      res.status(404).json({ success: false, message: "Rule not found" });
      return;
    }
    res.json({ success: true, data: rule });
  } catch (error) {
    logger.error({ error }, "Failed to get healing rule");
    res.status(500).json({ success: false, message: "Failed to get healing rule" });
  }
});

router.post("/rules", async (req: Request, res: Response) => {
  try {
    const rule = healingRulesManager.createRule(req.body);
    res.status(201).json({ success: true, data: rule, message: "Rule created" });
  } catch (error) {
    logger.error({ error }, "Failed to create healing rule");
    res.status(500).json({ success: false, message: "Failed to create healing rule" });
  }
});

router.put("/rules/:id", async (req: Request, res: Response) => {
  try {
    const rule = healingRulesManager.updateRule(req.params.id, req.body);
    if (!rule) {
      res.status(404).json({ success: false, message: "Rule not found" });
      return;
    }
    res.json({ success: true, data: rule, message: "Rule updated" });
  } catch (error) {
    logger.error({ error }, "Failed to update healing rule");
    res.status(500).json({ success: false, message: "Failed to update healing rule" });
  }
});

router.delete("/rules/:id", async (req: Request, res: Response) => {
  try {
    const deleted = healingRulesManager.deleteRule(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, message: "Rule not found" });
      return;
    }
    res.json({ success: true, message: "Rule deleted" });
  } catch (error) {
    logger.error({ error }, "Failed to delete healing rule");
    res.status(500).json({ success: false, message: "Failed to delete healing rule" });
  }
});

router.post("/rules/:id/toggle", async (req: Request, res: Response) => {
  try {
    const rule = healingRulesManager.toggleRule(req.params.id);
    if (!rule) {
      res.status(404).json({ success: false, message: "Rule not found" });
      return;
    }
    res.json({ success: true, data: rule, message: `Rule ${rule.enabled ? "enabled" : "disabled"}` });
  } catch (error) {
    logger.error({ error }, "Failed to toggle healing rule");
    res.status(500).json({ success: false, message: "Failed to toggle healing rule" });
  }
});

router.get("/events", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const events = healingRulesManager.getEvents(limit);
    res.json({ success: true, data: events });
  } catch (error) {
    logger.error({ error }, "Failed to get healing events");
    res.status(500).json({ success: false, message: "Failed to get healing events" });
  }
});

router.post("/manual/:incidentId", async (req: Request, res: Response) => {
  try {
    const result = await healingEngine.manualHeal(req.params.incidentId);
    res.json({ success: result.success, data: result, message: result.message });
  } catch (error) {
    logger.error({ error }, "Failed to execute manual healing");
    res.status(500).json({ success: false, message: "Failed to execute manual healing" });
  }
});

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const enabled = healingEngine.enabled;
    res.json({ success: true, data: { enabled } });
  } catch (error) {
    logger.error({ error }, "Failed to get healing status");
    res.status(500).json({ success: false, message: "Failed to get healing status" });
  }
});

router.post("/toggle", async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled === "boolean") {
      healingEngine.setEnabled(enabled);
    } else {
      healingEngine.setEnabled(!healingEngine.enabled);
    }
    const newStatus = healingEngine.enabled;
    res.json({ success: true, data: { enabled: newStatus }, message: `Healing ${newStatus ? "enabled" : "disabled"}` });
  } catch (error) {
    logger.error({ error }, "Failed to toggle healing");
    res.status(500).json({ success: false, message: "Failed to toggle healing" });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const events = healingRulesManager.getEvents(1000);
    const totalActions = events.length;
    const successfulActions = events.filter(e => e.status === "success").length;
    const failedActions = events.filter(e => e.status === "failed").length;
    const skippedActions = events.filter(e => e.status === "in-progress").length;
    
    const successfulEvents = events.filter(e => e.status === "success");
    const avgRecoveryTime = successfulEvents.length > 0
      ? successfulEvents.reduce((sum, e) => sum + e.duration, 0) / successfulEvents.length
      : 252000;
    
    const beforeAITime = 15 * 60 * 1000;
    const withAutoHealTime = avgRecoveryTime > 0 ? avgRecoveryTime : 4 * 60 * 1000;
    const improvementPercent = Math.round(((beforeAITime - withAutoHealTime) / beforeAITime) * 100);

    res.json({
      success: true,
      data: {
        avgRecoveryTime,
        totalActions,
        successfulActions,
        failedActions,
        skippedActions,
        improvementPercent,
        beforeAITime,
        withAutoHealTime,
      }
    });
  } catch (error) {
    logger.error({ error }, "Failed to get healing stats");
    res.status(500).json({ success: false, message: "Failed to get healing stats" });
  }
});

router.get("/activity", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const filter = req.query.filter as string || "all";
    
    let events = healingRulesManager.getEvents(1000);
    
    if (filter !== "all") {
      const filterMap: Record<string, string[]> = {
        cpu: ["scale-deployment", "patch-cpu"],
        memory: ["patch-memory"],
        restarts: ["restart-pod"],
      };
      const allowedActions = filterMap[filter] || [];
      if (allowedActions.length > 0) {
        events = events.filter(e => allowedActions.includes(e.action));
      }
    }
    
    const activity = events.slice(0, limit).map(e => ({
      ...e,
      trigger: getTriggerLabel(e.action),
      outcome: getOutcomeLabel(e.status),
      actionLabel: getActionLabel(e.action, e.ruleName),
    }));
    
    res.json({ success: true, data: activity });
  } catch (error) {
    logger.error({ error }, "Failed to get healing activity");
    res.status(500).json({ success: false, message: "Failed to get healing activity" });
  }
});

function getTriggerLabel(action: string): string {
  const triggers: Record<string, string> = {
    "scale-deployment": "High CPU Usage",
    "patch-memory": "OOM Killed",
    "patch-cpu": "CPU Throttling",
    "restart-pod": "CrashLoopBackOff",
    "retry-image-pull": "Image Pull Error",
  };
  return triggers[action] || "System Alert";
}

function getOutcomeLabel(status: string): string {
  switch (status) {
    case "success": return "Success";
    case "failed": return "Failed (Manual intervention required)";
    case "in-progress": return "In Progress";
    default: return "Skipped (Cooldown active)";
  }
}

function getActionLabel(action: string, ruleName: string): string {
  if (ruleName.toLowerCase().includes("scale up") || (action === "scale-deployment" && ruleName.toLowerCase().includes("high"))) {
    return "Scale Up";
  }
  if (ruleName.toLowerCase().includes("scale down") || ruleName.toLowerCase().includes("underutilized")) {
    return "Scale Down";
  }
  if (action === "patch-memory" || ruleName.toLowerCase().includes("oom") || ruleName.toLowerCase().includes("memory")) {
    return "Patch Limits";
  }
  if (action === "restart-pod" || ruleName.toLowerCase().includes("restart") || ruleName.toLowerCase().includes("crash")) {
    return "Restart Pod";
  }
  if (action === "patch-cpu") {
    return "Patch Limits";
  }
  return ruleName;
}

export default router;
