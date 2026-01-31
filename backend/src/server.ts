import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { createServer } from "http";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import routes from "./routes/index.js";
import { incidentDetector } from "./incidents/detector.js";
import { healingEngine } from "./healing/engine.js";
import { collectClusterMetrics } from "./metrics/cluster.metrics.js";
import { escalationManager } from "./escalation/escalation.manager.js";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: config.cors.origin,
    methods: ["GET", "POST"],
  },
});

app.use(helmet());
app.use(cors({ origin: config.cors.origin }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use("/api/v1", routes);

app.use(notFoundHandler);
app.use(errorHandler);

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "Client connected");

  socket.on("subscribe:cluster", (clusterId: string) => {
    socket.join(`cluster:${clusterId}`);
    logger.debug({ socketId: socket.id, clusterId }, "Client subscribed to cluster");
  });

  socket.on("unsubscribe:cluster", (clusterId: string) => {
    socket.leave(`cluster:${clusterId}`);
    logger.debug({ socketId: socket.id, clusterId }, "Client unsubscribed from cluster");
  });

  socket.on("subscribe:overview", () => {
    socket.join("overview");
    logger.debug({ socketId: socket.id }, "Client subscribed to overview");
    sendOverviewUpdate();
  });

  socket.on("unsubscribe:overview", () => {
    socket.leave("overview");
    logger.debug({ socketId: socket.id }, "Client unsubscribed from overview");
  });

  socket.on("disconnect", () => {
    logger.info({ socketId: socket.id }, "Client disconnected");
  });
});

export function emitClusterUpdate(clusterId: string, data: unknown) {
  io.to(`cluster:${clusterId}`).emit("cluster:update", data);
}

export function emitAlert(clusterId: string, alert: unknown) {
  io.to(`cluster:${clusterId}`).emit("alert:new", alert);
}

export function emitHealingEvent(clusterId: string, event: unknown) {
  io.to(`cluster:${clusterId}`).emit("healing:event", event);
}

async function sendOverviewUpdate() {
  try {
    const clusterMetrics = await collectClusterMetrics();
    const incidentStats = incidentDetector.getStats();
    const escalationStats = escalationManager.getStats();
    
    const overview = {
      cluster: clusterMetrics,
      incidents: incidentStats,
      escalations: escalationStats,
      automationFrozen: escalationManager.isAutomationFrozen(),
    };
    io.to("overview").emit("overview:update", overview);
  } catch (error) {
    logger.error({ error }, "Failed to send overview update");
  }
}

let overviewInterval: NodeJS.Timeout | null = null;

function startOverviewUpdates() {
  overviewInterval = setInterval(sendOverviewUpdate, 5000);
  logger.info("Started overview updates (5s interval)");
}

function stopOverviewUpdates() {
  if (overviewInterval) {
    clearInterval(overviewInterval);
    overviewInterval = null;
  }
}

function startServer() {
  httpServer.listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv }, "Server started");
    
    if (config.nodeEnv !== "test") {
      healingEngine.startEvaluation();
      incidentDetector.startDetection();
      startOverviewUpdates();
    }
  });
}

function gracefulShutdown() {
  logger.info("Shutting down gracefully...");
  healingEngine.stopEvaluation();
  incidentDetector.stopDetection();
  stopOverviewUpdates();
  
  httpServer.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forced shutdown");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

startServer();

export { app, httpServer, io };
