"use client";

import { NeedleBarGauge } from "./needle-bar-gauge";

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
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GiB`;
}

function formatUptime(seconds: number): string {
  const hours = seconds / 3600;
  return `${hours.toFixed(2)} hour`;
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
}: NodeResourceCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border hover:border-muted-foreground transition-colors overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        <h3 className="text-base font-medium text-foreground">~ {nodeName}</h3>
      </div>
      
      <div className="grid grid-cols-3 divide-x divide-border">
        <div className="p-6 flex items-center justify-center">
          <ResourceGauge label="CPU Usage" value={cpuUsagePercent} />
        </div>
        
        <div className="p-6 flex items-center justify-center">
          <ResourceGauge label="RAM Usage" value={memoryUsagePercent} />
        </div>
        
        <div className="p-6 flex flex-col items-center justify-center">
          <p className="text-sm text-muted-foreground mb-2">Pods on node</p>
          <p className="text-6xl font-bold text-primary font-mono">{podCount}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-5 divide-x divide-border border-t border-border">
        <div className="p-4 text-center">
          <p className="text-sm text-muted-foreground uppercase mb-2">CPU Used</p>
          <p className="text-xl font-semibold text-success font-mono">{cpuUsedCores.toFixed(3)}</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-sm text-muted-foreground uppercase mb-2">CPU Total</p>
          <p className="text-xl font-semibold text-foreground font-mono">{cpuTotalCores}</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-sm text-muted-foreground uppercase mb-2">RAM Used</p>
          <p className="text-xl font-semibold text-warning font-mono">{formatBytes(memoryUsageBytes)}</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-sm text-muted-foreground uppercase mb-2">RAM Total</p>
          <p className="text-xl font-semibold text-foreground font-mono">{formatBytes(memoryTotalBytes)}</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-sm text-muted-foreground uppercase mb-2">Uptime</p>
          <p className="text-xl font-semibold text-primary font-mono">{formatUptime(uptimeSeconds)}</p>
        </div>
      </div>
    </div>
  );
}
