"use client";

import { useClusters } from "@/hooks/use-clusters";
import { Loader2 } from "lucide-react";

export function ClusterSelector() {
  const { clusters, currentClusterId, isLoading, switchCluster } = useClusters();

  if (isLoading || clusters.length === 0) {
    return null;
  }

  const currentCluster = clusters.find((c) => c.id === currentClusterId);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600">Cluster:</span>
      <select
        value={currentClusterId}
        onChange={(e) => switchCluster(e.target.value)}
        className="text-sm bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {clusters.map((cluster) => (
          <option key={cluster.id} value={cluster.id}>
            {cluster.name}
          </option>
        ))}
      </select>
      {currentCluster && (
        <span className="text-xs text-gray-500">
          ({currentCluster.prometheusUrl})
        </span>
      )}
    </div>
  );
}
