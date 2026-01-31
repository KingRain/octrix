import { useState, useEffect, useCallback } from "react";
import type { TimelineEvent } from "@/components/ui/compact-vertical-timeline";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export function useTimeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${BACKEND_URL}/api/v1/timeline?limit=20`);
      const data = await response.json();
      
      if (data.success) {
        setEvents(data.data || []);
      } else {
        setError(data.message || "Failed to fetch timeline events");
      }
    } catch (err) {
      setError("Failed to connect to backend");
      console.error("Failed to fetch timeline events:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearTimeline = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/timeline/clear`, {
        method: "POST",
      });
      const data = await response.json();
      
      if (data.success) {
        setEvents([]);
      } else {
        setError(data.message || "Failed to clear timeline");
      }
    } catch (err) {
      setError("Failed to clear timeline");
      console.error("Failed to clear timeline:", err);
    }
  }, []);

  useEffect(() => {
    fetchTimeline();
    const interval = setInterval(fetchTimeline, 10000);
    return () => clearInterval(interval);
  }, [fetchTimeline]);

  return {
    events,
    isLoading,
    error,
    refetch: fetchTimeline,
    clear: clearTimeline,
  };
}
