"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { ClusterOverview } from "@/types/overview";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

let globalSocket: Socket | null = null;
let globalOverviewData: ClusterOverview | null = null;

export function useOverview() {
  const [overview, setOverview] = useState<ClusterOverview | null>(globalOverviewData);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(!globalOverviewData);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchOverview = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${BACKEND_URL}/api/v1/overview`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error("Failed to fetch overview");
      }
      const data = await response.json();
      if (data.success && data.data && mountedRef.current) {
        globalOverviewData = data.data;
        setOverview(data.data);
        setIsConnected(true);
        setError(null);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      if (err instanceof Error && err.name === "AbortError") {
        setError("Request timeout");
      } else {
        setError(err instanceof Error ? err.message : "Connection failed");
      }
      if (!globalOverviewData) {
        setIsConnected(false);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const setupSocket = () => {
      if (globalSocket?.connected) {
        setIsConnected(true);
        return;
      }

      if (globalSocket) {
        globalSocket.removeAllListeners();
        globalSocket.disconnect();
      }
      
      globalSocket = io(BACKEND_URL, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
        forceNew: false,
      });

      globalSocket.on("connect", () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        setError(null);
        globalSocket?.emit("subscribe:overview");
      });

      globalSocket.on("disconnect", () => {
        // Don't set isConnected to false - keep showing data
      });

      globalSocket.on("overview:update", (data: ClusterOverview) => {
        if (!mountedRef.current) return;
        globalOverviewData = data;
        setOverview(data);
        setIsConnected(true);
        setIsLoading(false);
        setError(null);
      });

      globalSocket.on("connect_error", () => {
        // Silent - will retry automatically
      });
    };

    if (globalOverviewData) {
      setOverview(globalOverviewData);
      setIsLoading(false);
      setIsConnected(true);
    }

    fetchOverview();
    setupSocket();

    const pollInterval = setInterval(() => {
      fetchOverview();
    }, 5000);

    return () => {
      mountedRef.current = false;
      clearInterval(pollInterval);
    };
  }, [fetchOverview]);

  return {
    overview,
    isConnected,
    isLoading,
    error,
    refetch: fetchOverview,
  };
}
