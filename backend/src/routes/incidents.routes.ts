import { Router, Request, Response } from "express";
import { incidentService } from "../services/incident.service.js";
import { incidentSummaryService } from "../services/incident-summary.service.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("incidents-routes");
const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const incidents = incidentService.getIncidents(status as Parameters<typeof incidentService.getIncidents>[0]);
    res.json({ success: true, data: incidents });
  } catch (error) {
    logger.error({ error }, "Failed to get incidents");
    res.status(500).json({ success: false, message: "Failed to get incidents" });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = incidentService.getIncidentStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error({ error }, "Failed to get incident stats");
    res.status(500).json({ success: false, message: "Failed to get incident stats" });
  }
});

router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const acknowledged = req.query.acknowledged === "true" 
      ? true 
      : req.query.acknowledged === "false" 
        ? false 
        : undefined;
    const alerts = incidentService.getAlerts(acknowledged);
    res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error({ error }, "Failed to get alerts");
    res.status(500).json({ success: false, message: "Failed to get alerts" });
  }
});

router.get("/:id/summary", async (req: Request, res: Response) => {
  try {
    const incidentId = req.params.id;
    const summary = await incidentSummaryService.generateSummary(incidentId);
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error({ error }, "Failed to generate incident summary");
    res.status(500).json({ success: false, message: "Failed to generate incident summary" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const incident = incidentService.getIncident(req.params.id);
    if (!incident) {
      res.status(404).json({ success: false, message: "Incident not found" });
      return;
    }
    res.json({ success: true, data: incident });
  } catch (error) {
    logger.error({ error }, "Failed to get incident");
    res.status(500).json({ success: false, message: "Failed to get incident" });
  }
});

router.post("/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const incident = incidentService.acknowledgeIncident(req.params.id);
    if (!incident) {
      res.status(404).json({ success: false, message: "Incident not found" });
      return;
    }
    res.json({ success: true, data: incident, message: "Incident acknowledged" });
  } catch (error) {
    logger.error({ error }, "Failed to acknowledge incident");
    res.status(500).json({ success: false, message: "Failed to acknowledge incident" });
  }
});

router.post("/:id/resolve", async (req: Request, res: Response) => {
  try {
    const incident = incidentService.resolveIncident(req.params.id);
    if (!incident) {
      res.status(404).json({ success: false, message: "Incident not found" });
      return;
    }
    res.json({ success: true, data: incident, message: "Incident resolved" });
  } catch (error) {
    logger.error({ error }, "Failed to resolve incident");
    res.status(500).json({ success: false, message: "Failed to resolve incident" });
  }
});

router.post("/alerts/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const alert = incidentService.acknowledgeAlert(req.params.id);
    if (!alert) {
      res.status(404).json({ success: false, message: "Alert not found" });
      return;
    }
    res.json({ success: true, data: alert, message: "Alert acknowledged" });
  } catch (error) {
    logger.error({ error }, "Failed to acknowledge alert");
    res.status(500).json({ success: false, message: "Failed to acknowledge alert" });
  }
});

router.post("/clear", async (_req: Request, res: Response) => {
  try {
    incidentService.clearHistory();
    res.json({ success: true, message: "Incident history cleared" });
  } catch (error) {
    logger.error({ error }, "Failed to clear incident history");
    res.status(500).json({ success: false, message: "Failed to clear incident history" });
  }
});

export default router;
