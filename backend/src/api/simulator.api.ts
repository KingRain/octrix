import { Router, Request, Response } from "express";
import { scenarioManager } from "../simulators/scenarios.js";
import { simulationRunner } from "../simulators/runner.js";
import { createChildLogger } from "../utils/logger.js";
import { z } from "zod";

const logger = createChildLogger("simulator-api");
const router = Router();

const startSimulationSchema = z.object({
  targetNamespace: z.string().min(1),
  targetResource: z.string().optional(),
  duration: z.number().min(10).max(3600).optional(),
});

router.get("/scenarios", async (_req: Request, res: Response) => {
  try {
    const scenarios = scenarioManager.getScenarios();
    res.json({ success: true, data: scenarios });
  } catch (error) {
    logger.error({ error }, "Failed to get scenarios");
    res.status(500).json({ success: false, message: "Failed to get scenarios" });
  }
});

router.get("/scenarios/:id", async (req: Request, res: Response) => {
  try {
    const scenario = scenarioManager.getScenario(req.params.id);
    if (!scenario) {
      res.status(404).json({ success: false, message: "Scenario not found" });
      return;
    }
    res.json({ success: true, data: scenario });
  } catch (error) {
    logger.error({ error }, "Failed to get scenario");
    res.status(500).json({ success: false, message: "Failed to get scenario" });
  }
});

router.post("/scenarios", async (req: Request, res: Response) => {
  try {
    const scenario = scenarioManager.createScenario(req.body);
    res.status(201).json({ success: true, data: scenario, message: "Scenario created" });
  } catch (error) {
    logger.error({ error }, "Failed to create scenario");
    res.status(500).json({ success: false, message: "Failed to create scenario" });
  }
});

router.delete("/scenarios/:id", async (req: Request, res: Response) => {
  try {
    const deleted = scenarioManager.deleteScenario(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, message: "Scenario not found" });
      return;
    }
    res.json({ success: true, message: "Scenario deleted" });
  } catch (error) {
    logger.error({ error }, "Failed to delete scenario");
    res.status(500).json({ success: false, message: "Failed to delete scenario" });
  }
});

router.post("/scenarios/:id/start", async (req: Request, res: Response) => {
  try {
    const parseResult = startSimulationSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ 
        success: false, 
        message: "Invalid configuration",
        errors: parseResult.error.errors 
      });
      return;
    }

    const { targetNamespace, targetResource, duration } = parseResult.data;
    const run = await simulationRunner.startSimulation(
      req.params.id,
      targetNamespace,
      targetResource,
      duration
    );
    res.status(201).json({ success: true, data: run, message: "Simulation started" });
  } catch (error) {
    logger.error({ error }, "Failed to start simulation");
    const message = error instanceof Error ? error.message : "Failed to start simulation";
    res.status(500).json({ success: false, message });
  }
});

router.get("/runs", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const runs = simulationRunner.getRuns(limit);
    res.json({ success: true, data: runs });
  } catch (error) {
    logger.error({ error }, "Failed to get simulation runs");
    res.status(500).json({ success: false, message: "Failed to get simulation runs" });
  }
});

router.get("/runs/active", async (_req: Request, res: Response) => {
  try {
    const runs = simulationRunner.getActiveRuns();
    res.json({ success: true, data: runs });
  } catch (error) {
    logger.error({ error }, "Failed to get active runs");
    res.status(500).json({ success: false, message: "Failed to get active runs" });
  }
});

router.get("/runs/:id", async (req: Request, res: Response) => {
  try {
    const run = simulationRunner.getRun(req.params.id);
    if (!run) {
      res.status(404).json({ success: false, message: "Run not found" });
      return;
    }
    res.json({ success: true, data: run });
  } catch (error) {
    logger.error({ error }, "Failed to get run");
    res.status(500).json({ success: false, message: "Failed to get run" });
  }
});

router.post("/runs/:id/stop", async (req: Request, res: Response) => {
  try {
    const run = await simulationRunner.stopSimulation(req.params.id);
    if (!run) {
      res.status(404).json({ success: false, message: "Run not found" });
      return;
    }
    res.json({ success: true, data: run, message: "Simulation stopped" });
  } catch (error) {
    logger.error({ error }, "Failed to stop simulation");
    res.status(500).json({ success: false, message: "Failed to stop simulation" });
  }
});

router.post("/runs/:id/cancel", async (req: Request, res: Response) => {
  try {
    const run = await simulationRunner.cancelSimulation(req.params.id);
    if (!run) {
      res.status(404).json({ success: false, message: "Run not found or not active" });
      return;
    }
    res.json({ success: true, data: run, message: "Simulation cancelled" });
  } catch (error) {
    logger.error({ error }, "Failed to cancel simulation");
    res.status(500).json({ success: false, message: "Failed to cancel simulation" });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = simulationRunner.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error({ error }, "Failed to get simulation stats");
    res.status(500).json({ success: false, message: "Failed to get simulation stats" });
  }
});

export default router;
