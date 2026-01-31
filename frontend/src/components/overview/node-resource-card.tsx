"use client";

import { useState } from "react";
import { NeedleBarGauge } from "./needle-bar-gauge";

interface PodMetricsInfo {
  name: string;
  namespace: string;
  cpuMillicores: number;
  memoryBytes: number;
}

interface NodeResourceCardProps {
  nodeName: string;
  cpuUsagePercent: number;
  cpuUsedCores: number;
  cpuTotalCores: number;
  memoryUsagePercent: number;
  memoryUsageBytes: number;
  memoryTotalBytes: number;
  podCount: number;
  uptimeSeconds: number;
  podMetrics?: PodMetricsInfo[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KiB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MiB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GiB`;
}

function formatUptime(seconds: number): string {
  if (seconds === 0) return "N/A";
  const hours = seconds / 3600;
  return `${hours.toFixed(2)} hour`;
}

function formatMillicores(millicores: number): string {
  if (millicores < 1000) return `${millicores}m`;
  return `${(millicores / 1000).toFixed(2)} cores`;
}

function ResourceGauge({ label, value }: { label: string; value: number }) {
  const isValidValue = typeof value === 'number' && !isNaN(value) && isFinite(value);
  const displayValue = isValidValue ? Math.max(0, Math.min(100, value)) : 0;

  if (!isValidValue) {
    return (
      <div className="flex flex-col items-center">
        <p className="text-sm text-muted-foreground mb-2">{label}</p>
        <div className="w-[180px] h-[130px] flex items-center justify-center">
          <p className="text-base text-muted-foreground">No data</p>
        </div>
      </div>
    );
  }

  return <NeedleBarGauge value={displayValue} label={label} />;
}

function PodMetricsTooltip({ pods }: { pods: PodMetricsInfo[] }) {
  if (!pods || pods.length === 0) {
    return (
      <div className="p-3 text-sm text-gray-400">
        No pod metrics available
      </div>
    );
  }

  // Sort by CPU usage descending
  const sortedPods = [...pods].sort((a, b) => b.cpuMillicores - a.cpuMillicores);
  const displayPods = sortedPods.slice(0, 10); // Show top 10

  return (
    <div className="p-3 max-h-80 overflow-y-auto">
      <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
        Pod Resource Usage (Top {displayPods.length})
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-700">
            <th className="text-left py-1 pr-2">Pod</th>
            <th className="text-right py-1 px-2">CPU</th>
            <th className="text-right py-1 pl-2">Memory</th>
          </tr>
        </thead>
        <tbody>
          {displayPods.map((pod, idx) => (
            <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
              <td className="py-1.5 pr-2">
                <div className="font-mono text-gray-300 truncate max-w-[150px]" title={pod.name}>
                  {pod.name}
                </div>
                <div className="text-gray-500 text-[10px]">{pod.namespace}</div>
              </td>
              <td className="text-right py-1.5 px-2 font-mono text-blue-400">
                {formatMillicores(pod.cpuMillicores)}
              </td>
              <td className="text-right py-1.5 pl-2 font-mono text-purple-400">
                {formatBytes(pod.memoryBytes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pods.length > 10 && (
        <div className="text-xs text-gray-500 mt-2 text-center">
          +{pods.length - 10} more pods
        </div>
      )}
    </div>
  );
}

export function NodeResourceCard({
  nodeName,
  cpuUsagePercent,
  cpuUsedCores,
  cpuTotalCores,
  memoryUsagePercent,
  memoryUsageBytes,
  memoryTotalBytes,
  podCount,
  uptimeSeconds,
  podMetrics,
}: NodeResourceCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="bg-card rounded-xl border border-border hover:border-muted-foreground transition-colors overflow-hidden relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Pod metrics tooltip on hover */}
      {showTooltip && podMetrics && podMetrics.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-gray-900 rounded-lg border border-gray-700 shadow-xl">
          <PodMetricsTooltip pods={podMetrics} />
        </div>
      )}


      <div className="grid grid-cols-3 divide-x divide-border">
        <div className="p-6 flex items-center justify-center">
          <ResourceGauge label="CPU Usage" value={cpuUsagePercent} />
        </div>

        <div className="p-6 flex items-center justify-center">
          <ResourceGauge label="RAM Usage" value={memoryUsagePercent} />
        </div>

        <div className="p-6 flex flex-col items-center justify-center">
          <p className="text-sm text-gray-900 mb-2">Pods on node</p>
          <p className="text-6xl font-bold text-gray-900 font-mono">{podCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 divide-x divide-border border-t border-border">
        <div className="p-4 text-center">
          <p className="text-sm text-black uppercase mb-2">CPU Used</p>
          <p className="text-xl font-semibold text-black font-mono">{cpuUsedCores.toFixed(3)} cores</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-sm text-black uppercase mb-2">CPU Total</p>
          <p className="text-xl font-semibold text-black font-mono">{cpuTotalCores.toFixed(1)} cores</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-sm text-black uppercase mb-2">RAM Used</p>
          <p className="text-xl font-semibold text-black font-mono">{formatBytes(memoryUsageBytes)}</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-sm text-black uppercase mb-2">RAM Total</p>
          <p className="text-xl font-semibold text-black font-mono">{formatBytes(memoryTotalBytes)}</p>
        </div>
      </div>
    </div>
  );
}
