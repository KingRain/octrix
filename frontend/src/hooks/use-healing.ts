"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export interface HealingRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: {
    type: string;
    conditions: Array<{
      metric: string;
      operator: string;
      value: number;
      duration: string;
    }>;
    operator: string;
  };
  action: {
    type: string;
    parameters: Record<string, unknown>;
  };
  cooldownSeconds: number;
  triggerCount: number;
  lastTriggered?: string;
  createdAt: string;
}

export interface HealingEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  timestamp: string;
  status: "in-progress" | "success" | "failed";
  targetResource: string;
  targetNamespace: string;
  action: string;
  details: string;
  duration: number;
}

interface HealingStatus {
  enabled: boolean;
}

interface UseHealingReturn {
  rules: HealingRule[];
  events: HealingEvent[];
  status: HealingStatus | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  toggleRule: (id: string) => Promise<boolean>;
  toggleHealer: (enabled: boolean) => Promise<boolean>;
  deleteRule: (id: string) => Promise<boolean>;
  createRule: (rule: Omit<HealingRule, "id" | "createdAt" | "triggerCount">) => Promise<HealingRule | null>;
}

export function useHealing(): UseHealingReturn {
  const [rules, setRules] = useState<HealingRule[]>([]);
  const [events, setEvents] = useState<HealingEvent[]>([]);
  const [status, setStatus] = useState<HealingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const [rulesRes, eventsRes, statusRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/healing/rules`, { signal: controller.signal }),
        fetch(`${BACKEND_URL}/api/v1/healing/events?limit=50`, { signal: controller.signal }),
        fetch(`${BACKEND_URL}/api/v1/healing/status`, { signal: controller.signal }),
      ]);

      clearTimeout(timeoutId);

      if (!rulesRes.ok || !eventsRes.ok || !statusRes.ok) {
        throw new Error("Failed to fetch healing data");
      }

      const rulesData = await rulesRes.json();
      const eventsData = await eventsRes.json();
      const statusData = await statusRes.json();

      if (mountedRef.current) {
        if (rulesData.success) {
          setRules(rulesData.data);
        }
        if (eventsData.success) {
          setEvents(eventsData.data);
        }
        if (statusData.success) {
          setStatus(statusData.data);
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
  }, []);

  const toggleRule = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/healing/rules/${id}/toggle`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRules((prev) =>
            prev.map((rule) => (rule.id === id ? data.data : rule))
          );
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const toggleHealer = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/healing/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStatus(data.data);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const deleteRule = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/healing/rules/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setRules((prev) => prev.filter((rule) => rule.id !== id));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const createRule = useCallback(async (
    rule: Omit<HealingRule, "id" | "createdAt" | "triggerCount">
  ): Promise<HealingRule | null> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/healing/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRules((prev) => [...prev, data.data]);
          return data.data;
        }
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    const pollInterval = setInterval(fetchData, 10000);

    return () => {
      mountedRef.current = false;
      clearInterval(pollInterval);
    };
  }, [fetchData]);

  return {
    rules,
    events,
    status,
    isLoading,
    error,
    refetch: fetchData,
    toggleRule,
    toggleHealer,
    deleteRule,
    createRule,
  };
}
