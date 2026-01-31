"use client";

import { useState, useEffect } from "react";
import { Server, Loader2, Copy, RefreshCw, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

interface NodeMetrics {
  nodeName: string;
  cpuUsagePercent: number;
  cpuUsedCores: number;
  cpuTotalCores: number;
  memoryUsagePercent: number;
  memoryUsageBytes: number;
  memoryTotalBytes: number;
  diskUsagePercent: number;
  podCount: number;
  uptimeSeconds: number;
}

interface PodInfo {
  id: string;
  name: string;
  namespace: string;
  nodeName: string;
  status: string;
  cpu: number;
  memory: number;
  restarts: number;
}

function formatUptime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} mins`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours`;
  const days = Math.floor(hours / 24);
  return `${days} days`;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
      <div 
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

function getProgressColor(value: number): string {
  if (value < 50) return "bg-cyan-500";
  if (value < 75) return "bg-yellow-500";
  return "bg-red-500";
}

export default function NodesPage() {
  const [nodes, setNodes] = useState<NodeMetrics[]>([]);
  const [pods, setPods] = useState<PodInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestarting, setIsRestarting] = useState(false);

  const fetchData = async () => {
    try {
      const [nodesRes, overviewRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/overview/nodes`),
        fetch(`${BACKEND_URL}/api/v1/overview`),
      ]);
      
      const nodesData = await nodesRes.json();
      const overviewData = await overviewRes.json();
      
      if (nodesData.success && nodesData.data) {
        setNodes(nodesData.data);
      }
      
      if (overviewData.success && overviewData.data?.services) {
        const allPods: PodInfo[] = [];
        overviewData.data.services.forEach((service: { pods: PodInfo[]; namespace: string }) => {
          service.pods.forEach((pod: PodInfo) => {
            allPods.push({
              ...pod,
              namespace: service.namespace || "default",
              nodeName: nodes.length > 0 ? nodes[Math.floor(Math.random() * nodes.length)].nodeName : "minikube",
            });
          });
        });
        setPods(allPods);
      }
    } catch (error) {
      console.error("Failed to fetch nodes data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestartAll = async () => {
    setIsRestarting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/cluster/pods/restart-all`, {
        method: "POST",
      });
      const data = await response.json();
      if (data.success) {
        // Refresh the page after a short delay
        setTimeout(() => fetchData(), 1000);
      }
    } catch (error) {
      console.error("Failed to restart pods:", error);
    } finally {
      setIsRestarting(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nodes</h1>
          <p className="text-sm text-muted-foreground">
            The base Kubernetes Node resource represents a virtual or physical machine which hosts deployments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            onClick={handleRestartAll}
            disabled={isRestarting}
          >
            {isRestarting ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Restarting...
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restart All Pods
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="bg-[#0d1117] rounded-lg border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">State</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Roles</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Version</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">External/Internal IP</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">OS</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-32">CPU</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-32">RAM</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Pods</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Age</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node, idx) => (
                <tr 
                  key={node.nodeName} 
                  className={cn(
                    "border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors",
                    idx % 2 === 0 ? "bg-[#0d1117]" : "bg-[#161b22]"
                  )}
                >
                  <td className="px-4 py-3">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30">
                      Active
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-cyan-400 font-mono text-sm hover:underline cursor-pointer">
                      {node.nodeName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    Control Plane, Etcd
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 font-mono">
                    v1.27.6+k3s1
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span>- / 192.168.3.{21 + idx}</span>
                      <Copy className="h-3 w-3 text-gray-500 cursor-pointer hover:text-gray-300" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    Linux
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <ProgressBar 
                        value={node.cpuUsagePercent} 
                        color={getProgressColor(node.cpuUsagePercent)} 
                      />
                      <span className="text-xs text-gray-400">{node.cpuUsagePercent.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <ProgressBar 
                        value={node.memoryUsagePercent} 
                        color={getProgressColor(node.memoryUsagePercent)} 
                      />
                      <span className="text-xs text-gray-400">{node.memoryUsagePercent.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {node.podCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {formatUptime(node.uptimeSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-purple-400" />
            <h2 className="text-lg font-medium">Pods ({pods.length})</h2>
          </div>
        </div>
        
        <div className="bg-[#0d1117] rounded-lg border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Namespace</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Node</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">CPU</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Memory</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Restarts</th>
                </tr>
              </thead>
              <tbody>
                {pods.map((pod) => (
                  <tr key={pod.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="px-4 py-3 text-sm font-mono text-cyan-400">{pod.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{pod.namespace}</td>
                    <td className="px-4 py-3">
                      <Badge 
                        className={cn(
                          "text-xs",
                          pod.status === "healthy" && "bg-green-500/20 text-green-400",
                          pod.status === "healing" && "bg-yellow-500/20 text-yellow-400",
                          pod.status === "failed" && "bg-red-500/20 text-red-400",
                          pod.status === "pending" && "bg-blue-500/20 text-blue-400"
                        )}
                      >
                        {pod.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{pod.nodeName}</td>
                    <td className="px-4 py-3">
                      <div className="w-full">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>{pod.cpu}m</span>
                          <span className="text-gray-500">{Math.round(pod.cpu / 40)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${Math.min(100, Math.round((pod.cpu / 40) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-full">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>{(pod.memory / 1024 / 1024).toFixed(0)}Mi</span>
                          <span className="text-gray-500">{Math.round(pod.memory / 8192)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-purple-500"
                            style={{ width: `${Math.min(100, Math.round((pod.memory / 8192) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{pod.restarts}</td>
                  </tr>
                ))}
                {pods.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                      No pods found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
