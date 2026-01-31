import { Router } from "express";
import { overviewService } from "../services/overview.service.js";
import { collectNodeMetrics } from "../metrics/node.metrics.js";
import { prometheusService } from "../services/prometheus.service.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("overview-routes");
const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const overview = await overviewService.getClusterOverview();
    res.json({ success: true, data: overview });
  } catch (error) {
    logger.error({ error }, "Failed to get cluster overview");
    next(error);
  }
});

router.get("/health", async (req, res) => {
  try {
    const overview = await overviewService.getClusterOverview();
    res.json({
      success: true,
      data: {
        connected: overview.connected,
        totalPods: overview.totalPods,
        healthyPods: overview.healthyPods,
      },
    });
  } catch (error) {
    res.json({
      success: true,
      data: { connected: false, totalPods: 0, healthyPods: 0 },
    });
  }
});

router.get("/nodes", async (req, res, next) => {
  try {
    const nodeMetrics = await collectNodeMetrics();
    res.json({ success: true, data: nodeMetrics });
  } catch (error) {
    logger.error({ error }, "Failed to get node metrics");
    next(error);
  }
});

router.get("/oom-warnings", async (req, res, next) => {
  try {
    const podMetrics = await prometheusService.getPodMetrics();
    const oomWarnings = podMetrics
      .filter((pod) => pod.timeToOomSeconds !== undefined && pod.timeToOomSeconds < 300)
      .map((pod) => ({
        podName: pod.podName,
        namespace: pod.namespace,
        timeToOomSeconds: pod.timeToOomSeconds,
        memoryUsageBytes: pod.memoryUsageBytes,
        memoryLimitBytes: pod.memoryLimitBytes || 256 * 1024 * 1024,
      }));

    res.json({ success: true, data: oomWarnings });
  } catch (error) {
    logger.error({ error }, "Failed to get OOM warnings");
    next(error);
  }
});

// New endpoint for direct kubectl top metrics
router.get("/kubectl-metrics", async (req, res, next) => {
  try {
    const nodeMetrics = await collectNodeMetrics();

    // Format response with node metrics and their pod details
    const response = nodeMetrics.map(node => ({
      nodeName: node.nodeName,
      cpu: {
        usedCores: node.cpuUsedCores,
        totalCores: node.cpuTotalCores,
        usagePercent: node.cpuUsagePercent,
      },
      memory: {
        usedBytes: node.memoryUsageBytes,
        totalBytes: node.memoryTotalBytes,
        usagePercent: node.memoryUsagePercent,
      },
      podCount: node.podCount,
      pods: node.podMetrics || [],
    }));

    res.json({ success: true, data: response, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error({ error }, "Failed to get kubectl metrics");
    next(error);
  }
});

export default router;

