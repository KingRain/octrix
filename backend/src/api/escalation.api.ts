import { Router, Request, Response } from "express";
import { escalationManager } from "../escalation/escalation.manager.js";
import { notificationService } from "../escalation/notifications.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("escalation-api");
const router = Router();

router.get("/records", async (_req: Request, res: Response) => {
  try {
    const records = escalationManager.getEscalationRecords();
    res.json({ success: true, data: records });
  } catch (error) {
    logger.error({ error }, "Failed to get escalation records");
    res.status(500).json({ success: false, message: "Failed to get escalation records" });
  }
});

router.get("/records/:incidentId", async (req: Request, res: Response) => {
  try {
    const record = escalationManager.getEscalationRecord(req.params.incidentId);
    if (!record) {
      res.status(404).json({ success: false, message: "Escalation record not found" });
      return;
    }
    res.json({ success: true, data: record });
  } catch (error) {
    logger.error({ error }, "Failed to get escalation record");
    res.status(500).json({ success: false, message: "Failed to get escalation record" });
  }
});

router.post("/records/:incidentId/acknowledge", async (req: Request, res: Response) => {
  try {
    const acknowledgedBy = req.body.acknowledgedBy || "system";
    const record = escalationManager.acknowledgeEscalation(req.params.incidentId, acknowledgedBy);
    if (!record) {
      res.status(404).json({ success: false, message: "Escalation record not found" });
      return;
    }
    res.json({ success: true, data: record, message: "Escalation acknowledged" });
  } catch (error) {
    logger.error({ error }, "Failed to acknowledge escalation");
    res.status(500).json({ success: false, message: "Failed to acknowledge escalation" });
  }
});

router.get("/policies", async (_req: Request, res: Response) => {
  try {
    const policies = escalationManager.getPolicies();
    res.json({ success: true, data: policies });
  } catch (error) {
    logger.error({ error }, "Failed to get escalation policies");
    res.status(500).json({ success: false, message: "Failed to get escalation policies" });
  }
});

router.put("/policies/:id", async (req: Request, res: Response) => {
  try {
    const policy = escalationManager.updatePolicy(req.params.id, req.body);
    if (!policy) {
      res.status(404).json({ success: false, message: "Policy not found" });
      return;
    }
    res.json({ success: true, data: policy, message: "Policy updated" });
  } catch (error) {
    logger.error({ error }, "Failed to update escalation policy");
    res.status(500).json({ success: false, message: "Failed to update escalation policy" });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = escalationManager.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error({ error }, "Failed to get escalation stats");
    res.status(500).json({ success: false, message: "Failed to get escalation stats" });
  }
});

router.get("/automation/status", async (_req: Request, res: Response) => {
  try {
    const frozen = escalationManager.isAutomationFrozen();
    res.json({ 
      success: true, 
      data: { 
        frozen,
        message: frozen ? "Automation is frozen - manual intervention required" : "Automation is active"
      } 
    });
  } catch (error) {
    logger.error({ error }, "Failed to get automation status");
    res.status(500).json({ success: false, message: "Failed to get automation status" });
  }
});

router.post("/automation/unfreeze", async (req: Request, res: Response) => {
  try {
    const acknowledgedBy = req.body.acknowledgedBy || "system";
    const unfrozen = escalationManager.unfreezeAutomation(acknowledgedBy);
    if (!unfrozen) {
      res.status(400).json({ success: false, message: "Automation was not frozen" });
      return;
    }
    res.json({ success: true, message: "Automation unfrozen" });
  } catch (error) {
    logger.error({ error }, "Failed to unfreeze automation");
    res.status(500).json({ success: false, message: "Failed to unfreeze automation" });
  }
});

router.get("/notifications", async (req: Request, res: Response) => {
  try {
    const incidentId = req.query.incidentId as string | undefined;
    const notifications = notificationService.getNotifications(incidentId);
    res.json({ success: true, data: notifications });
  } catch (error) {
    logger.error({ error }, "Failed to get notifications");
    res.status(500).json({ success: false, message: "Failed to get notifications" });
  }
});

router.get("/notifications/config", async (_req: Request, res: Response) => {
  try {
    const configs = notificationService.getConfigs();
    res.json({ success: true, data: configs });
  } catch (error) {
    logger.error({ error }, "Failed to get notification configs");
    res.status(500).json({ success: false, message: "Failed to get notification configs" });
  }
});

export default router;
