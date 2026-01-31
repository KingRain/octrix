import { createChildLogger } from "../utils/logger.js";

interface SimulatedPodConfig {
  namespace: string;
  name: string;
  limitBytes: number;
  baseUsageBytes: number;
  growthRateBytesPerSecond: number;
}

interface SimulatedPodState extends SimulatedPodConfig {
  startTime: number;
}

class CustomPodSimulator {
  private pods: Map<string, SimulatedPodState> = new Map();
  private logger = createChildLogger("custom-pod-simulator");

  private getKey(namespace: string, name: string) {
    return `${namespace}/${name}`;
  }

  registerPod(config: SimulatedPodConfig): void {
    const key = this.getKey(config.namespace, config.name);
    this.pods.set(key, { ...config, startTime: Date.now() });
    this.logger.info(
      { namespace: config.namespace, name: config.name, limitBytes: config.limitBytes },
      "Registered simulated pod",
    );
  }

  removePod(namespace: string, name: string): void {
    const key = this.getKey(namespace, name);
    if (this.pods.delete(key)) {
      this.logger.info({ namespace, name }, "Removed simulated pod");
    }
  }

  clear(): void {
    this.pods.clear();
    this.logger.info("Cleared all simulated pods");
  }

  getMetrics(namespace?: string) {
    const now = Date.now();
    return Array.from(this.pods.values())
      .filter((pod) => !namespace || pod.namespace === namespace)
      .map((pod) => {
      const elapsedSeconds = (now - pod.startTime) / 1000;
      const usage = Math.min(
        pod.limitBytes,
        pod.baseUsageBytes + pod.growthRateBytesPerSecond * elapsedSeconds,
      );
      const remaining = Math.max(0, pod.limitBytes - usage);
      const timeToOomSeconds = pod.growthRateBytesPerSecond > 0
        ? remaining / pod.growthRateBytesPerSecond
        : remaining === 0
          ? 0
          : undefined;

      return {
        podName: pod.name,
        namespace: pod.namespace,
        nodeName: "octrix-sim-node",
        cpuUsageCores: 0.1,
        cpuRequestCores: 0.05,
        cpuLimitCores: 0.5,
        memoryUsageBytes: usage,
        memoryRequestBytes: Math.max(32 * 1024 * 1024, usage * 0.6),
        memoryLimitBytes: pod.limitBytes,
        restartCount: 0,
        containerStatuses: [],
        timeToOomSeconds,
        memoryGrowthRateBytesPerSecond:
          pod.growthRateBytesPerSecond > 0 ? pod.growthRateBytesPerSecond : undefined,
      };
    });
  }
}

export const customPodSimulator = new CustomPodSimulator();
