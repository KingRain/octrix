import { Router, Request, Response } from "express";
import { healingService } from "../services/healing.service.js";
import { incidentService } from "../services/incident.service.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("timeline-api");
const router = Router();

interface TimelineEvent {
  id: string;
  time: string;
  type: string;
  service: string;
  message: string;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    // Get incidents from incident service
    const incidents = incidentService.getIncidents();

    // Convert incidents to timeline format
    const timelineFromIncidents: TimelineEvent[] = incidents
      .slice(0, limit)
      .map((incident) => {
        const timestamp = new Date(incident.detectedAt);
        const time = timestamp.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        return {
          id: `incident-${incident.id}`,
          time,
          type: "Incident",
          service: incident.resource,
          message: incident.title,
        };
      });

    // Sort by time (most recent first)
    const sortedEvents = timelineFromIncidents.sort((a, b) => {
      const timeA = new Date(`1970-01-01 ${a.time}`).getTime();
      const timeB = new Date(`1970-01-01 ${b.time}`).getTime();
      return timeB - timeA;
    }).slice(0, limit);

    res.json({ success: true, data: sortedEvents });
  } catch (error) {
    logger.error({ error }, "Failed to get timeline events");
    res.status(500).json({ success: false, message: "Failed to get timeline events" });
  }
});

router.post("/clear", async (_req: Request, res: Response) => {
  try {
    incidentService.clearHistory();
    res.json({ success: true, message: "Timeline cleared" });
  } catch (error) {
    logger.error({ error }, "Failed to clear timeline");
    res.status(500).json({ success: false, message: "Failed to clear timeline" });
  }
});

export default router;
