import { Router, Request, Response } from "express";
import { healingRulesManager } from "../healing/rules.js";
import { incidentDetector } from "../incidents/detector.js";
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

    // Get healing events
    const healingEvents = healingRulesManager.getEvents(100);
    
    // Get incidents
    const incidents = incidentDetector.getIncidents();

    // Convert healing events to timeline format
    const timelineFromHealing: TimelineEvent[] = healingEvents
      .slice(0, limit)
      .map((event) => {
        const timestamp = new Date(event.timestamp);
        const time = timestamp.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        let type = "Healing";
        let message = "";
        
        switch (event.action) {
          case "scale-deployment":
            type = "Scaling";
            message = `Scaled ${event.targetResource}`;
            break;
          case "restart-pod":
            type = "Restart";
            message = `Restarted ${event.targetResource}`;
            break;
          case "patch-memory":
            type = "Config";
            message = `Updated memory limits for ${event.targetResource}`;
            break;
          case "patch-cpu":
            type = "Config";
            message = `Updated CPU limits for ${event.targetResource}`;
            break;
          default:
            type = "Healing";
            message = `Applied ${event.action} to ${event.targetResource}`;
        }

        return {
          id: `healing-${event.id}`,
          time,
          type,
          service: event.targetResource,
          message,
        };
      });

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

    // Combine and sort by time (most recent first)
    const combinedEvents = [...timelineFromHealing, ...timelineFromIncidents]
      .sort((a, b) => {
        const timeA = new Date(`1970-01-01 ${a.time}`).getTime();
        const timeB = new Date(`1970-01-01 ${b.time}`).getTime();
        return timeB - timeA;
      })
      .slice(0, limit);

    res.json({ success: true, data: combinedEvents });
  } catch (error) {
    logger.error({ error }, "Failed to get timeline events");
    res.status(500).json({ success: false, message: "Failed to get timeline events" });
  }
});

router.post("/clear", async (_req: Request, res: Response) => {
  try {
    healingRulesManager.clearEvents();
    res.json({ success: true, message: "Timeline cleared" });
  } catch (error) {
    logger.error({ error }, "Failed to clear timeline");
    res.status(500).json({ success: false, message: "Failed to clear timeline" });
  }
});

export default router;
