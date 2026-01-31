"use client";

import { Loader2, Activity, Heart, AlertTriangle, XCircle, Shield, Server } from "lucide-react";
import { ServiceTriangle, NodeResourceCard, OOMAlertPopup } from "@/components/overview";
import { useOverview } from "@/hooks/use-overview";
import type { NodeMetrics } from "@/types/overview";
import { useBackendStatus } from "@/hooks/use-backend-status";
import { useRef, useEffect, useState, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import type { ServiceGroup } from "@/types/overview";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

interface OOMWarning {
  podName: string;
  namespace: string;
  timeToOomSeconds: number;
  memoryUsageBytes: number;
  memoryLimitBytes: number;
}

export default function OverviewPage() {
  const { overview, isConnected, isLoading } = useOverview();
  useBackendStatus();
  const [nodeMetrics, setNodeMetrics] = useState<NodeMetrics[]>([]);
  const [oomWarnings, setOomWarnings] = useState<OOMWarning[]>([]);
  
  const [displayServices, setDisplayServices] = useState<ServiceGroup[]>([]);
  const [displayStats, setDisplayStats] = useState({
    usedCpu: 0,
    totalCpu: 0,
    usedMemory: 0,
    totalMemory: 0,
    totalPods: 0,
    healthyPods: 0,
    healingPods: 0,
    failedPods: 0,
  });
  const [healerEnabled, setHealerEnabled] = useState(true);
  const [healerLoading, setHealerLoading] = useState(false);
  const hasReceivedDataRef = useRef(false);

  const fetchOomWarnings = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/overview/oom-warnings`);
      const data = await response.json();
      if (data.success) {
        setOomWarnings(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch OOM warnings:", error);
    }
  }, []);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/v1/healing/status`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setHealerEnabled(data.data.enabled);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchNodes = () => {
      fetch(`${BACKEND_URL}/api/v1/overview/nodes`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setNodeMetrics(data.data);
          }
        })
        .catch(() => {});
    };
    fetchNodes();
    const interval = setInterval(fetchNodes, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchOomWarnings();
    const interval = setInterval(fetchOomWarnings, 10000);
    return () => clearInterval(interval);
  }, [fetchOomWarnings]);

  const toggleHealer = useCallback(async (enabled: boolean) => {
    setHealerLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/healing/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setHealerEnabled(data.data.enabled);
      }
    } catch {
    } finally {
      setHealerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (overview?.services && overview.services.length > 0) {
      hasReceivedDataRef.current = true;
      setDisplayServices(overview.services);
      setDisplayStats({
        usedCpu: overview.usedCpu,
        totalCpu: overview.totalCpu,
        usedMemory: overview.usedMemory,
        totalMemory: overview.totalMemory,
        totalPods: overview.totalPods,
        healthyPods: overview.healthyPods,
        healingPods: overview.healingPods,
        failedPods: overview.failedPods,
      });
    }
  }, [overview]);

  const showLoading = isLoading && !hasReceivedDataRef.current;

  return (
    <div className="space-y-6 min-h-screen bg-gray-100 p-6">
      <OOMAlertPopup 
        alerts={oomWarnings} 
        onDismiss={(podName) => {
          setOomWarnings(prev => prev.filter(w => w.podName !== podName));
        }}
      />
      
      <div className="flex items-center justify-between bg-gray-200 p-4 rounded-lg">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Overview</h1>
          <p className="text-sm text-gray-600">
            OTT Streaming Platform - Real-time pod status visualization
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-gray-700">
            <Shield className={`h-4 w-4 ${healerEnabled ? "text-green-500" : "text-gray-500"}`} />
            <span className="text-xs text-gray-300">Auto-Healer</span>
            <Switch
              checked={healerEnabled}
              onCheckedChange={toggleHealer}
              disabled={healerLoading}
              className="data-[state=checked]:bg-green-600"
            />
          </div>
          <div className="h-6 w-px bg-gray-700" />
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-green-500" />
              <span className="text-gray-900">{displayStats.healthyPods} Healthy</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-900">{displayStats.healingPods} Healing</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-gray-900">{displayStats.failedPods} Failed</span>
            </div>
          </div>
          <div className="h-6 w-px bg-gray-700" />
          {showLoading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Connecting...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`} />
              <span className="text-sm text-gray-900">
                {isConnected ? "Live" : "Reconnecting..."}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-green-400 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-medium text-gray-900">Service Pod Status</h2>
          <span className="text-xs text-gray-500 ml-2">
            {displayServices.slice(0, 6).length} service groups
          </span>
        </div>
        {displayServices.length > 0 ? (
          <div className="relative py-2 overflow-x-auto">
            <div className="flex items-start justify-center gap-1 flex-wrap">
              {displayServices.slice(0, 6).map((service) => (
                <ServiceTriangle
                  key={service.name}
                  service={service}
                  isConnected={service.pods.length > 0}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-center py-16 w-full">
            {showLoading ? (
              <div className="flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                <span>Connecting to cluster...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
                <span>Waiting for cluster data...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {nodeMetrics.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-medium text-gray-900">Node Resources</h2>
            <span className="text-xs text-gray-500 ml-2">
              {nodeMetrics.length} node{nodeMetrics.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {nodeMetrics.map((node) => (
              <NodeResourceCard
                key={node.nodeName}
                nodeName={node.nodeName}
                cpuUsagePercent={node.cpuUsagePercent}
                cpuUsedCores={node.cpuUsedCores}
                cpuTotalCores={node.cpuTotalCores}
                memoryUsagePercent={node.memoryUsagePercent}
                memoryUsageBytes={node.memoryUsageBytes}
                memoryTotalBytes={node.memoryTotalBytes}
                podCount={node.podCount}
                uptimeSeconds={node.uptimeSeconds}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
