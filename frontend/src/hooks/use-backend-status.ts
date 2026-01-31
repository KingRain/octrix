"use client";

import { useState, useEffect, useCallback } from "react";

interface BackendStatus {
  status: string;
  timestamp: string;
  services: {
    backend: {
      status: string;
      uptime: number;
    };
    prometheus: {
      status: string;
      url?: string;
      lastCheck?: string;
      usingMockData: boolean;
    };
  };
}

interface UseBackendStatusReturn {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  backendStatus: BackendStatus | null;
  prometheusConnected: boolean;
  usingMockData: boolean;
  uptime: number;
  refetch: () => Promise<void>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function useBackendStatus(pollInterval = 30000): UseBackendStatusReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_BASE_URL}/api/v1/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const data = await response.json();
      setBackendStatus(data);
      setIsConnected(true);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Connection failed";
      
      if (errorMessage.includes("abort")) {
        setError("Backend connection timed out");
      } else if (errorMessage.includes("fetch")) {
        setError("Cannot reach backend server");
      } else {
        setError(errorMessage);
      }
      
      setIsConnected(false);
      setBackendStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [fetchStatus, pollInterval]);

  const prometheusConnected = backendStatus?.services?.prometheus?.status === "connected";
  const usingMockData = backendStatus?.services?.prometheus?.usingMockData ?? true;
  const uptime = backendStatus?.services?.backend?.uptime ?? 0;

  return {
    isConnected,
    isLoading,
    error,
    backendStatus,
    prometheusConnected,
    usingMockData,
    uptime,
    refetch: fetchStatus,
  };
}
