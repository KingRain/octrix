"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ClusterHealthSummaryProps {
  healthy: number;
  healing: number;
  escalated: number;
  total: number;
  cpuUsage: number;
  cpuLimit: number;
  memoryUsage: number;
  memoryLimit: number;
  uptime: string;
}

function CircularGauge({
  value,
  max,
  label,
  color,
}: {
  value: number;
  max: number;
  label: string;
  color: string;
}) {
  const percentage = Math.round((value / max) * 100);
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/20"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 50 50)"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold">{percentage}%</span>
        </div>
      </div>
      <span className="mt-2 text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function ClusterHealthSummary({
  healthy,
  healing,
  escalated,
  total,
  cpuUsage,
  cpuLimit,
  memoryUsage,
  memoryLimit,
  uptime,
}: ClusterHealthSummaryProps) {
  const cpuColor = cpuUsage / cpuLimit > 0.8 ? "#ef4444" : cpuUsage / cpuLimit > 0.6 ? "#eab308" : "#22c55e";
  const memColor = memoryUsage / memoryLimit > 0.8 ? "#ef4444" : memoryUsage / memoryLimit > 0.6 ? "#eab308" : "#22c55e";

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-6">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Overview
        </div>

        <div className="flex items-center justify-between gap-6">
          <CircularGauge
            value={cpuUsage}
            max={cpuLimit}
            label="CPU Usage"
            color={cpuColor}
          />

          <CircularGauge
            value={memoryUsage}
            max={memoryLimit}
            label="RAM Usage"
            color={memColor}
          />

          <div className="flex flex-col items-center">
            <div className="text-5xl font-bold text-foreground">{total}</div>
            <span className="mt-2 text-xs text-muted-foreground">Pods on node</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4 mt-6 pt-4 border-t border-border/30">
          <div className="text-center">
            <div className="text-sm font-medium">{(cpuUsage / 1000).toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">CPU Used</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium">{Math.round(cpuLimit / 1000)}</div>
            <div className="text-xs text-muted-foreground">CPU Total</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium">{(memoryUsage / 1024).toFixed(1)} <span className="text-xs text-muted-foreground">GB</span></div>
            <div className="text-xs text-muted-foreground">RAM Used</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium">{(memoryLimit / 1024).toFixed(1)} <span className="text-xs text-muted-foreground">GB</span></div>
            <div className="text-xs text-muted-foreground">RAM Total</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium">{uptime}</div>
            <div className="text-xs text-muted-foreground">Uptime</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border/30">
          <div className="flex items-center gap-2">
            <span className={cn("h-3 w-3 rounded-full bg-green-500")} />
            <span className="text-sm">
              <span className="font-medium">{healthy}</span>
              <span className="text-muted-foreground ml-1">Healthy</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("h-3 w-3 rounded-full bg-yellow-500", healing > 0 && "animate-pulse")} />
            <span className="text-sm">
              <span className="font-medium">{healing}</span>
              <span className="text-muted-foreground ml-1">Healing</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("h-3 w-3 rounded-full bg-red-500")} />
            <span className="text-sm">
              <span className="font-medium">{escalated}</span>
              <span className="text-muted-foreground ml-1">Escalated</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
