import { useState, useEffect, useCallback } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export interface Cluster {
  id: string;
  name: string;
  prometheusUrl: string;
  kubeConfigPath?: string;
  k8sContext?: string;
}

export function useClusters() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [currentClusterId, setCurrentClusterId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClusters = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${BACKEND_URL}/api/v1/cluster/clusters`);
      const data = await response.json();
      
      if (data.success) {
        setClusters(data.data.clusters || []);
        setCurrentClusterId(data.data.currentClusterId || "");
      } else {
        setError(data.message || "Failed to fetch clusters");
      }
    } catch (err) {
      setError("Failed to connect to backend");
      console.error("Failed to fetch clusters:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const switchCluster = useCallback(async (clusterId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/cluster/clusters/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clusterId }),
      });
      const data = await response.json();
      
      if (data.success) {
        setCurrentClusterId(clusterId);
        return true;
      } else {
        setError(data.message || "Failed to switch cluster");
        return false;
      }
    } catch (err) {
      setError("Failed to switch cluster");
      console.error("Failed to switch cluster:", err);
      return false;
    }
  }, []);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  return {
    clusters,
    currentClusterId,
    isLoading,
    error,
    refetch: fetchClusters,
    switchCluster,
  };
}
