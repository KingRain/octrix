"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

interface NodeUtilData {
  nodeName: string;
  cpuUsedCores: number;
  cpuCapacityCores: number;
  cpuUtilPct: number;
  memUsedBytes: number;
  memCapacityBytes: number;
  memUtilPct: number;
  status: "underutilized" | "healthy" | "saturated";
  wasteScore: number;
  estimatedCostPerHour: number;
}

interface ClusterSummary {
  totalNodes: number;
  avgCpuUtil: number;
  avgMemUtil: number;
  p90CpuUtil: number;
  p90MemUtil: number;
  underutilizedNodes: number;
  saturatedNodes: number;
  healthyNodes: number;
  runRatePerHour: number;
  idleCpuCores: number;
  idleMemoryGB: number;
  totalCpuCores: number;
  totalMemoryGB: number;
}

interface CostInsight {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  evidence: string[];
  potentialSavings?: number;
}

interface NodeUtilizationData {
  nodes: NodeUtilData[];
  summary: ClusterSummary;
  insights: CostInsight[];
  dataQuality: {
    hasPrometheus: boolean;
    mode: "real-usage" | "container-fallback" | "unavailable";
  };
  generatedAt: string;
}

export type { NodeUtilData, ClusterSummary, CostInsight, NodeUtilizationData };

interface UseNodeUtilizationReturn {
  data: NodeUtilizationData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useNodeUtilization(): UseNodeUtilizationReturn {
  const [data, setData] = useState<NodeUtilizationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/v1/costs/node-utilization`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch node utilization data");
      }
      
      const result = await response.json();
      
      if (mountedRef.current && result.success) {
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch node utilization data");
        setData(null);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    
    const interval = setInterval(fetchData, 30000);
    
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
