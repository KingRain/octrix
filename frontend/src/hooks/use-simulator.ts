"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  type: string;
  incidentCategory: string;
  severity: "low" | "medium" | "high" | "critical";
  autoHealable: boolean;
  productionBehavior: string;
  localSimulation: string;
  parameters: Record<string, unknown>;
  duration: number;
  createdAt: string;
}

export interface SimulationRun {
  id: string;
  scenarioId: string;
  scenarioName: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startTime: string;
  endTime?: string;
  targetNamespace: string;
  targetResource?: string;
  affectedResources: string[];
  incidentId?: string;
  metrics: SimulationMetric[];
}

export interface SimulationMetric {
  name: string;
  before: number;
  during: number;
  after: number;
  unit: string;
}

export interface SimulatorStats {
  totalRuns: number;
  activeRuns: number;
  last24h: {
    total: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
}

interface UseSimulatorReturn {
  scenarios: SimulationScenario[];
  runs: SimulationRun[];
  activeRuns: SimulationRun[];
  stats: SimulatorStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  startSimulation: (scenarioId: string, targetNamespace: string, targetResource?: string, duration?: number, parameters?: Record<string, unknown>) => Promise<SimulationRun | null>;
  stopSimulation: (runId: string) => Promise<boolean>;
  cancelSimulation: (runId: string) => Promise<boolean>;
}

export function useSimulator(): UseSimulatorReturn {
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [runs, setRuns] = useState<SimulationRun[]>([]);
  const [activeRuns, setActiveRuns] = useState<SimulationRun[]>([]);
  const [stats, setStats] = useState<SimulatorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const [scenariosRes, runsRes, activeRes, statsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/simulator/scenarios`, { signal: controller.signal }),
        fetch(`${BACKEND_URL}/api/v1/simulator/runs?limit=20`, { signal: controller.signal }),
        fetch(`${BACKEND_URL}/api/v1/simulator/runs/active`, { signal: controller.signal }),
        fetch(`${BACKEND_URL}/api/v1/simulator/stats`, { signal: controller.signal }),
      ]);

      clearTimeout(timeoutId);

      const parseResponse = async (res: Response, name: string) => {
        if (!res.ok) {
           console.warn(`Failed to fetch ${name}: ${res.status} ${res.statusText}`);
           return { success: false };
        }
        try {
          return await res.json();
        } catch (e) {
          console.error(`Failed to parse ${name} JSON:`, e);
          return { success: false };
        }
      };

      const scenariosData = await parseResponse(scenariosRes, "scenarios");
      const runsData = await parseResponse(runsRes, "runs");
      const activeData = await parseResponse(activeRes, "activeRuns");
      const statsData = await parseResponse(statsRes, "stats");

      if (mountedRef.current) {
        if (scenariosData.success) setScenarios(scenariosData.data);
        if (runsData.success) setRuns(runsData.data);
        if (activeData.success) {
           // Filter out any non-active runs just in case, though backend should handle this
           const active = (activeData.data as SimulationRun[]) || [];
           setActiveRuns(active.filter(r => r.status === 'running' || r.status === 'pending'));
        }
        if (statsData.success) setStats(statsData.data);
        setError(null);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      if (err instanceof Error && err.name === "AbortError") {
        setError("Request timeout");
      } else {
        setError(err instanceof Error ? err.message : "Connection failed");
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const startSimulation = useCallback(async (
    scenarioId: string,
    targetNamespace: string,
    targetResource?: string,
    duration?: number,
    parameters?: Record<string, unknown>
  ): Promise<SimulationRun | null> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/simulator/scenarios/${scenarioId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetNamespace,
          targetResource,
          duration,
          parameters,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to start simulation");
      }

      const data = await response.json();
      if (data.success) {
        await fetchData();
        return data.data;
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start simulation");
      return null;
    }
  }, [fetchData]);

  const stopSimulation = useCallback(async (runId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/simulator/runs/${runId}/stop`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [fetchData]);

  const cancelSimulation = useCallback(async (runId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/simulator/runs/${runId}/cancel`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [fetchData]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    const pollInterval = setInterval(fetchData, 5000);

    return () => {
      mountedRef.current = false;
      clearInterval(pollInterval);
    };
  }, [fetchData]);

  return {
    scenarios,
    runs,
    activeRuns,
    stats,
    isLoading,
    error,
    refetch: fetchData,
    startSimulation,
    stopSimulation,
    cancelSimulation,
  };
}
