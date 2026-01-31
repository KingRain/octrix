import { exec } from "child_process";
import { promisify } from "util";
import { createChildLogger } from "../utils/logger.js";

const execAsync = promisify(exec);
const logger = createChildLogger("kubectl-top-service");

export interface KubectlNodeMetrics {
    name: string;
    cpuCores: string;       // e.g., "250m" or "1"
    cpuPercent: number;     // e.g., 25
    memoryBytes: string;    // e.g., "1024Mi"
    memoryPercent: number;  // e.g., 50
}

export interface KubectlPodMetrics {
    namespace: string;
    name: string;
    cpuCores: string;      // e.g., "100m"
    memoryBytes: string;   // e.g., "256Mi"
    nodeName?: string;     // Will be populated from pod info
}

export interface KubectlTopData {
    nodes: KubectlNodeMetrics[];
    pods: KubectlPodMetrics[];
    lastUpdated: Date;
}

class KubectlTopService {
    private cachedData: KubectlTopData | null = null;
    private lastFetchTime: number = 0;
    private readonly CACHE_TTL_MS = 5000; // 5 seconds cache

    /**
     * Parse CPU value to millicores
     * Examples: "250m" -> 250, "1" -> 1000, "2500m" -> 2500
     */
    parseCpuToMillicores(cpu: string): number {
        if (!cpu || cpu === "<unknown>") return 0;
        cpu = cpu.trim();
        if (cpu.endsWith("m")) {
            return parseInt(cpu.slice(0, -1), 10) || 0;
        }
        // If no 'm' suffix, it's in cores - convert to millicores
        return (parseFloat(cpu) || 0) * 1000;
    }

    /**
     * Parse memory value to bytes
     * Examples: "256Mi" -> 268435456, "1Gi" -> 1073741824, "512Ki" -> 524288
     */
    parseMemoryToBytes(memory: string): number {
        if (!memory || memory === "<unknown>") return 0;
        memory = memory.trim();

        const units: Record<string, number> = {
            Ki: 1024,
            Mi: 1024 * 1024,
            Gi: 1024 * 1024 * 1024,
            Ti: 1024 * 1024 * 1024 * 1024,
            K: 1000,
            M: 1000 * 1000,
            G: 1000 * 1000 * 1000,
            T: 1000 * 1000 * 1000 * 1000,
        };

        for (const [unit, multiplier] of Object.entries(units)) {
            if (memory.endsWith(unit)) {
                return parseInt(memory.slice(0, -unit.length), 10) * multiplier;
            }
        }

        return parseInt(memory, 10) || 0;
    }

    /**
     * Execute kubectl top nodes and parse the output
     */
    async getNodeMetrics(): Promise<KubectlNodeMetrics[]> {
        try {
            const { stdout } = await execAsync("kubectl top nodes --no-headers");
            const lines = stdout.trim().split("\n").filter(line => line.trim());

            return lines.map(line => {
                // Output format: NAME CPU(cores) CPU% MEMORY(bytes) MEMORY%
                const parts = line.trim().split(/\s+/);
                if (parts.length < 5) {
                    logger.warn({ line }, "Unexpected kubectl top nodes output format");
                    return null;
                }

                const [name, cpuCores, cpuPercentStr, memoryBytes, memoryPercentStr] = parts;

                return {
                    name,
                    cpuCores,
                    cpuPercent: parseInt(cpuPercentStr.replace("%", ""), 10) || 0,
                    memoryBytes,
                    memoryPercent: parseInt(memoryPercentStr.replace("%", ""), 10) || 0,
                };
            }).filter((node): node is KubectlNodeMetrics => node !== null);
        } catch (error) {
            logger.error({ error }, "Failed to execute kubectl top nodes");
            return [];
        }
    }

    /**
     * Execute kubectl top pods -A and parse the output
     */
    async getPodMetrics(): Promise<KubectlPodMetrics[]> {
        try {
            const { stdout } = await execAsync("kubectl top pods -A --no-headers");
            const lines = stdout.trim().split("\n").filter(line => line.trim());

            return lines.map(line => {
                // Output format: NAMESPACE NAME CPU(cores) MEMORY(bytes)
                const parts = line.trim().split(/\s+/);
                if (parts.length < 4) {
                    logger.warn({ line }, "Unexpected kubectl top pods output format");
                    return null;
                }

                const [namespace, name, cpuCores, memoryBytes] = parts;

                return {
                    namespace,
                    name,
                    cpuCores,
                    memoryBytes,
                };
            }).filter((pod): pod is KubectlPodMetrics => pod !== null);
        } catch (error) {
            logger.error({ error }, "Failed to execute kubectl top pods");
            return [];
        }
    }

    /**
     * Get cached kubectl top data or fetch fresh data if cache expired
     */
    async getTopData(forceRefresh = false): Promise<KubectlTopData> {
        const now = Date.now();

        if (!forceRefresh && this.cachedData && (now - this.lastFetchTime) < this.CACHE_TTL_MS) {
            return this.cachedData;
        }

        logger.debug("Fetching fresh kubectl top data");

        const [nodes, pods] = await Promise.all([
            this.getNodeMetrics(),
            this.getPodMetrics(),
        ]);

        this.cachedData = {
            nodes,
            pods,
            lastUpdated: new Date(),
        };
        this.lastFetchTime = now;

        logger.info({
            nodeCount: nodes.length,
            podCount: pods.length
        }, "kubectl top data refreshed");

        return this.cachedData;
    }

    /**
     * Get aggregated pod metrics by node
     */
    async getPodMetricsByNode(): Promise<Map<string, KubectlPodMetrics[]>> {
        const data = await this.getTopData();
        const podsByNode = new Map<string, KubectlPodMetrics[]>();

        // We need to get pod info to know which node each pod is on
        try {
            const { stdout } = await execAsync(
                "kubectl get pods -A -o custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name,NODE:.spec.nodeName --no-headers"
            );

            const podNodeMap = new Map<string, string>();
            const lines = stdout.trim().split("\n").filter(line => line.trim());
            logger.debug({ lineCount: lines.length }, "kubectl get pods output lines");

            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 3) {
                    const [namespace, name, nodeName] = parts;
                    const podKey = `${namespace}/${name}`;
                    podNodeMap.set(podKey, nodeName);
                }
            });

            logger.debug({ mapSize: podNodeMap.size }, "Pod-to-Node map size");

            // Associate pods with their nodes
            for (const pod of data.pods) {
                const podKey = `${pod.namespace}/${pod.name}`;
                const nodeName = podNodeMap.get(podKey);

                if (nodeName) {
                    pod.nodeName = nodeName;
                    const existingPods = podsByNode.get(nodeName) || [];
                    existingPods.push(pod);
                    podsByNode.set(nodeName, existingPods);
                }
            }
        } catch (error) {
            logger.error({ error }, "Failed to get pod-to-node mapping");
        }

        return podsByNode;
    }
}

export const kubectlTopService = new KubectlTopService();
