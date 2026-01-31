import { Router, Request, Response } from "express";
import { incidentDetector } from "../incidents/detector.js";
import { incidentSummaryService } from "../services/incident-summary.service.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("incidents-api");
const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const incidents = incidentDetector.getIncidents(status as Parameters<typeof incidentDetector.getIncidents>[0]);
    res.json({ success: true, data: incidents });
  } catch (error) {
    logger.error({ error }, "Failed to get incidents");
    res.status(500).json({ success: false, message: "Failed to get incidents" });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = incidentDetector.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error({ error }, "Failed to get incident stats");
    res.status(500).json({ success: false, message: "Failed to get incident stats" });
  }
});

router.get("/:id/summary", async (req: Request, res: Response) => {
  try {
    const summary = await incidentSummaryService.generateSummary(req.params.id);
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error({ error }, "Failed to generate incident summary");
    res.status(500).json({ success: false, message: "Failed to generate incident summary" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const incident = incidentDetector.getIncident(req.params.id);
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
    const incident = incidentDetector.acknowledgeIncident(req.params.id);
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
    const incident = incidentDetector.resolveIncident(req.params.id);
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

router.post("/clear", async (_req: Request, res: Response) => {
  try {
    incidentDetector.clearHistory();
    res.json({ success: true, message: "Incident history cleared" });
  } catch (error) {
    logger.error({ error }, "Failed to clear incident history");
    res.status(500).json({ success: false, message: "Failed to clear incident history" });
  }
});

export default router;
