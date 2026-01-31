"use client";

import { UsageGauge } from "./usage-gauge";

interface StatsPanelProps {
  cpuUsed: number;
  cpuTotal: number;
  memoryUsed: number;
  memoryTotal: number;
  podCount: number;
  uptime: number;
}

function formatBytes(bytes: number): { value: number; unit: string } {
  if (bytes === 0) return { value: 0, unit: "GiB" };
  const gib = bytes / (1024 * 1024 * 1024);
  return { value: gib, unit: "GiB" };
}

function formatUptime(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  }
  return `${hours.toFixed(2)} hour`;
}

export function StatsPanel({
  cpuUsed,
  cpuTotal,
  memoryUsed,
  memoryTotal,
  podCount,
  uptime,
}: StatsPanelProps) {
  const cpuPercent = cpuTotal > 0 ? (cpuUsed / cpuTotal) * 100 : 0;
  const memPercent = memoryTotal > 0 ? (memoryUsed / memoryTotal) * 100 : 0;
  
  const memUsedFormatted = formatBytes(memoryUsed);
  const memTotalFormatted = formatBytes(memoryTotal);
  const cpuUsedCores = cpuUsed / 1000;
  const cpuTotalCores = cpuTotal / 1000;

  return (
    <div className="bg-[#1e1e1e] rounded-lg border border-gray-800">
      <div className="px-4 py-2 border-b border-gray-800">
        <p className="text-sm text-gray-400">~ Overview</p>
      </div>
      
      <div className="grid grid-cols-3 divide-x divide-gray-800">
        <div className="p-6">
          <UsageGauge
            label="CPU Usage"
            value={cpuPercent}
            max={100}
            showPercentage={true}
          />
        </div>
        
        <div className="p-6">
          <UsageGauge
            label="RAM Usage"
            value={memPercent}
            max={100}
            showPercentage={true}
          />
        </div>
        
        <div className="p-6 flex flex-col items-center justify-center">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Pods on node</p>
          <span className="text-6xl font-bold text-blue-400">{podCount}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-5 divide-x divide-gray-800 border-t border-gray-800">
        <div className="p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">CPU Used</p>
          <p className="text-2xl font-bold text-white">{cpuUsedCores.toFixed(3)}</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">CPU Total</p>
          <p className="text-2xl font-bold text-white">{cpuTotalCores}</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">RAM Used</p>
          <p className="text-2xl font-bold text-white">
            {memUsedFormatted.value.toFixed(1)} <span className="text-sm text-gray-400">{memUsedFormatted.unit}</span>
          </p>
        </div>
        <div className="p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">RAM Total</p>
          <p className="text-2xl font-bold text-white">
            {memTotalFormatted.value.toFixed(1)} <span className="text-sm text-gray-400">{memTotalFormatted.unit}</span>
          </p>
        </div>
        <div className="p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">uptime</p>
          <p className="text-2xl font-bold text-green-500">{formatUptime(uptime)}</p>
        </div>
      </div>
    </div>
  );
}
