import { useState, useEffect, useCallback } from "react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export interface NodeUtilization {
  nodeName: string;
  cpuUsedCores: number;
  cpuCapacityCores: number;
  cpuUtilPercent: number;
  memUsedBytes: number;
  memCapacityBytes: number;
  memUtilPercent: number;
  status: "healthy" | "underutilized" | "saturated";
  wasteScore: number;
  estimatedHourlyCost: number;
  podCount: number;
  labels: Record<string, string>;
}

export interface ClusterUtilizationSummary {
  totalNodes: number;
  avgCpuUtil: number;
  avgMemUtil: number;
  p90CpuUtil: number;
  p90MemUtil: number;
  underutilizedNodes: number;
  saturatedNodes: number;
  totalCpuCores: number;
  totalMemoryBytes: number;
  usedCpuCores: number;
  usedMemoryBytes: number;
  idleCpuCores: number;
  idleMemoryBytes: number;
  estimatedHourlyRunRate: number;
  estimatedMonthlyCost: number;
}

export interface CostOptimizationInsight {
  id: string;
  type: "consolidation" | "waste" | "savings" | "info";
  title: string;
  description: string;
  severity: "high" | "medium" | "low" | "info";
  evidence: {
    metric: string;
    value: string;
    threshold?: string;
  }[];
  potentialSavings?: {
    hourly: number;
    monthly: number;
  };
}

export interface NodeUtilizationData {
  summary: ClusterUtilizationSummary;
  nodes: NodeUtilization[];
  insights: CostOptimizationInsight[];
  costConfig: {
    defaultNodeHourlyCost: number;
    nodeTypeCosts: Record<string, number>;
  };
}

interface UseNodeUtilizationResult {
  data: NodeUtilizationData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useNodeUtilization(
  refreshInterval: number = 30000
): UseNodeUtilizationResult {
  const [data, setData] = useState<NodeUtilizationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/costs/node-utilization`);
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setError(null);
      } else {
        throw new Error(result.message || "Failed to fetch node utilization data");
      }
    } catch (err) {
      console.error("Failed to fetch node utilization data:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setData(getMockData());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return { data, isLoading, error, refetch: fetchData };
}

function getMockData(): NodeUtilizationData {
  return {
    summary: {
      totalNodes: 3,
      avgCpuUtil: 34.6,
      avgMemUtil: 34.4,
      p90CpuUtil: 68.8,
      p90MemUtil: 62.5,
      underutilizedNodes: 1,
      saturatedNodes: 0,
      totalCpuCores: 20,
      totalMemoryBytes: 40 * 1024 * 1024 * 1024,
      usedCpuCores: 7.5,
      usedMemoryBytes: 14.5 * 1024 * 1024 * 1024,
      idleCpuCores: 12.5,
      idleMemoryBytes: 25.5 * 1024 * 1024 * 1024,
      estimatedHourlyRunRate: 0.25,
      estimatedMonthlyCost: 180,
    },
    nodes: [
      {
        nodeName: "octrix-control-plane",
        cpuUsedCores: 0.8,
        cpuCapacityCores: 4,
        cpuUtilPercent: 20,
        memUsedBytes: 2 * 1024 * 1024 * 1024,
        memCapacityBytes: 8 * 1024 * 1024 * 1024,
        memUtilPercent: 25,
        status: "healthy",
        wasteScore: 0.15,
        estimatedHourlyCost: 0.05,
        podCount: 12,
        labels: { role: "control-plane" },
      },
      {
        nodeName: "octrix-worker-01",
        cpuUsedCores: 1.2,
        cpuCapacityCores: 8,
        cpuUtilPercent: 15,
        memUsedBytes: 2.5 * 1024 * 1024 * 1024,
        memCapacityBytes: 16 * 1024 * 1024 * 1024,
        memUtilPercent: 15.6,
        status: "underutilized",
        wasteScore: 0.29,
        estimatedHourlyCost: 0.1,
        podCount: 8,
        labels: { role: "worker" },
      },
      {
        nodeName: "octrix-worker-02",
        cpuUsedCores: 5.5,
        cpuCapacityCores: 8,
        cpuUtilPercent: 68.75,
        memUsedBytes: 10 * 1024 * 1024 * 1024,
        memCapacityBytes: 16 * 1024 * 1024 * 1024,
        memUtilPercent: 62.5,
        status: "healthy",
        wasteScore: 0,
        estimatedHourlyCost: 0.1,
        podCount: 15,
        labels: { role: "worker" },
      },
    ],
    insights: [
      {
        id: "underutilized-nodes",
        type: "consolidation",
        title: "1 node is underutilized",
        description:
          "1 of 3 nodes (33%) have both CPU and memory utilization below 20%. Consider consolidating workloads.",
        severity: "medium",
        evidence: [
          { metric: "Underutilized nodes", value: "1" },
          { metric: "Threshold", value: "<20% CPU AND <20% Memory", threshold: "20%" },
          { metric: "Avg cluster CPU util", value: "34.6%" },
          { metric: "Avg cluster Memory util", value: "34.4%" },
        ],
      },
      {
        id: "idle-capacity",
        type: "waste",
        title: "Significant idle capacity detected",
        description:
          "Your cluster has 12.5 idle CPU cores and 25.5 GB idle memory. This represents unused capacity you're paying for.",
        severity: "high",
        evidence: [
          { metric: "Idle CPU cores", value: "12.5 cores" },
          { metric: "Idle Memory", value: "25.5 GB" },
          { metric: "Total CPU cores", value: "20 cores" },
          { metric: "Total Memory", value: "40 GB" },
        ],
      },
    ],
    costConfig: {
      defaultNodeHourlyCost: 0.1,
      nodeTypeCosts: {},
    },
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatCurrency(value: number, decimals: number = 2): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value.toFixed(decimals)}`;
}
