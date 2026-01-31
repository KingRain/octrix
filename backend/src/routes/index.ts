import { Router } from "express";
import metricsRouter from "../api/metrics.api.js";
import incidentsRouter from "../api/incidents.api.js";
import healingRouter from "../api/healing.api.js";
import escalationRouter from "../api/escalation.api.js";
import simulatorRouter from "../api/simulator.api.js";
import clusterRouter from "../api/cluster.api.js";
import overviewRouter from "./overview.routes.js";

const router = Router();

router.use("/metrics", metricsRouter);
router.use("/incidents", incidentsRouter);
router.use("/healing", healingRouter);
router.use("/escalation", escalationRouter);
router.use("/simulator", simulatorRouter);
router.use("/cluster", clusterRouter);
router.use("/overview", overviewRouter);

router.get("/health", async (_req, res) => {
  try {
    const { prometheusCollector } = await import("../metrics/prometheus.collector.js");
    const prometheusConnected = await prometheusCollector.checkConnection();
    const prometheusStatus = prometheusCollector.getStatus();
    
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      services: {
        backend: { status: "connected", uptime: process.uptime() },
        prometheus: { 
          status: prometheusConnected ? "connected" : "disconnected",
          url: prometheusStatus.url,
          lastCheck: prometheusStatus.lastCheck,
          usingMockData: !prometheusConnected
        }
      }
    });
  } catch (error) {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      services: {
        backend: { status: "connected", uptime: process.uptime() },
        prometheus: { status: "error", usingMockData: true }
      }
    });
  }
});

export default router;
