"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "acknowledged" | "healing" | "escalated" | "resolved";
export type IncidentCategory =
  | "oom-killed"
  | "high-cpu"
  | "high-memory"
  | "crash-loop"
  | "pod-throttling"
  | "underutilization"
  | "node-eviction"
  | "image-pull-delay"
  | "buggy-deployment"
  | "configmap-error"
  | "db-failure"
  | "unknown-crash"
  | "multi-service-failure"
  | "node-not-ready"
  | "node-pressure";

export type SLOBurnDriver = "traffic-surge" | "degradation" | "mixed";

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  category: IncidentCategory;
  status: IncidentStatus;
  resource: string;
  resourceType: "pod" | "node" | "deployment" | "service" | "configmap";
  namespace: string;
  detectedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  autoHealingAttempted: boolean;
  autoHealingResult?: "success" | "failed" | "pending";
  escalated: boolean;
  escalatedAt?: string;
  autoHealable: boolean;
  suggestedAction: string;
  productionBehavior: string;
  metrics: Record<string, number | string | boolean>;
  relatedAlerts: string[];
  summary?: IncidentSummary;
  // Dynamic SLO burn driver classification from backend
  sloBurnDriver?: SLOBurnDriver;
  sloBurnEvidence?: string;
  sloBurnConfidence?: number;
  // Legacy field for backward compatibility
  evidence?: string;
}

export interface IncidentSummary {
  incidentId: string;
  rootSuspect: string;
  impact: string;
  signals: string[];
  classification: string;
  blastRadius: string;
  generatedAt: string;
}

export interface IncidentCommandOutput {
  label: string;
  command: string;
  output: string;
  updatedAt: string;
}

export interface IncidentLogs {
  incidentId: string;
  commands: IncidentCommandOutput[];
}

export interface IncidentStats {
  total: number;
  open: number;
  acknowledged: number;
  healing: number;
  escalated: number;
  resolved: number;
  last24h: {
    total: number;
    bySeverity: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
    autoHealed: number;
    autoHealFailed: number;
    escalated: number;
  };
}

interface UseIncidentsReturn {
  incidents: Incident[];
  stats: IncidentStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  acknowledgeIncident: (id: string) => Promise<boolean>;
  resolveIncident: (id: string) => Promise<boolean>;
  clearHistory: () => Promise<boolean>;
  fetchIncidentSummary: (id: string) => Promise<IncidentSummary | null>;
  fetchIncidentLogs: (id: string) => Promise<IncidentLogs | null>;
}

export function useIncidents(statusFilter?: IncidentStatus): UseIncidentsReturn {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchIncidents = useCallback(async () => {
    try {
      const url = statusFilter
        ? `${BACKEND_URL}/api/v1/incidents?status=${statusFilter}`
        : `${BACKEND_URL}/api/v1/incidents`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const [incidentsRes, statsRes] = await Promise.all([
        fetch(url, { signal: controller.signal }),
        fetch(`${BACKEND_URL}/api/v1/incidents/stats`, { signal: controller.signal }),
      ]);

      clearTimeout(timeoutId);

      if (!incidentsRes.ok || !statsRes.ok) {
        throw new Error("Failed to fetch incidents");
      }

      const incidentsData = await incidentsRes.json();
      const statsData = await statsRes.json();

      if (mountedRef.current) {
        if (incidentsData.success) {
          setIncidents(incidentsData.data);
        }
        if (statsData.success) {
          setStats(statsData.data);
        }
        setError(null);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      // Don't set error on timeout, just keep showing cached data
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      // Only show error for network errors, not for other errors
      if (err instanceof Error && err.message.includes("Failed to fetch")) {
        setError("Connection issue - showing cached data");
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [statusFilter]);

  const acknowledgeIncident = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/incidents/${id}/acknowledge`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchIncidents();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [fetchIncidents]);

  const resolveIncident = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/incidents/${id}/resolve`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchIncidents();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [fetchIncidents]);

  const clearHistory = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/incidents/clear`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchIncidents();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [fetchIncidents]);

  const fetchIncidentSummary = useCallback(async (id: string): Promise<IncidentSummary | null> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/incidents/${id}/summary`);
      if (response.ok) {
        const data = await response.json();
        return data.data || null;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const fetchIncidentLogs = useCallback(async (id: string): Promise<IncidentLogs | null> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/incidents/${id}/logs`);
      if (response.ok) {
        const data = await response.json();
        return data.data || null;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchIncidents();

    const pollInterval = setInterval(fetchIncidents, 10000);

    return () => {
      mountedRef.current = false;
      clearInterval(pollInterval);
    };
  }, [fetchIncidents]);

  return {
    incidents,
    stats,
    isLoading,
    error,
    refetch: fetchIncidents,
    acknowledgeIncident,
    resolveIncident,
    clearHistory,
    fetchIncidentSummary,
    fetchIncidentLogs,
  };
}
