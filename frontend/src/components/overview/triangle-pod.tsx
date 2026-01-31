"use client";

import { cn } from "@/lib/utils";
import type { PVCInfo } from "@/types/overview";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type PodHealth =
  | "healthy"
  | "healing"
  | "failed"
  | "pending"
  | "unknown"
  | "disconnected";

interface TrianglePodProps {
  name: string;
  health: PodHealth;
  cpu: number;
  memory: number;
  restarts: number;
  pvcHealth?: "healthy" | "warning" | "critical" | "none";
  pvcs?: PVCInfo[];
  timeToOomSeconds?: number;
  memoryGrowthRateBytesPerSecond?: number;
  size?: number;
  showTooltip?: boolean;
}

const healthColors: Record<PodHealth, { fill: string; stroke: string }> = {
  healthy: { fill: "#22c55e", stroke: "#16a34a" },
  healing: { fill: "#fbbf24", stroke: "#f59e0b" },
  failed: { fill: "#ef4444", stroke: "#dc2626" },
  pending: { fill: "#60a5fa", stroke: "#3b82f6" },
  unknown: { fill: "#6b7280", stroke: "#4b5563" },
  disconnected: { fill: "#374151", stroke: "#1f2937" },
};

const healthLabels: Record<PodHealth, { label: string; color: string }> = {
  healthy: { label: "Healthy", color: "text-success" },
  healing: { label: "Healing", color: "text-warning" },
  failed: { label: "Failed", color: "text-destructive" },
  pending: { label: "Pending", color: "text-primary" },
  unknown: { label: "Unknown", color: "text-muted-foreground" },
  disconnected: { label: "Disconnected", color: "text-muted-foreground" },
};

export function TrianglePod({
  name,
  health,
  cpu,
  memory,
  restarts,
  pvcHealth,
  pvcs,
  timeToOomSeconds,
  memoryGrowthRateBytesPerSecond,
  size = 20,
  showTooltip = true,
}: TrianglePodProps) {
  const colors = healthColors[health];
  const height = size * 0.866;

  const triangle = (
    <svg
      width={size}
      height={height}
      viewBox="0 0 100 86.6"
      className={cn(
        "transition-all duration-200",
        health === "healing" && "animate-pulse",
        health !== "disconnected" && "hover:brightness-125 hover:scale-110",
      )}
    >
      <polygon
        points="50,0 100,86.6 0,86.6"
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="2"
        className="transition-colors"
      />
      {(pvcHealth === "critical" ||
        (timeToOomSeconds !== undefined && timeToOomSeconds < 300)) && (
        <circle
          cx="50"
          cy="55"
          r="15"
          fill="#ef4444"
          className="animate-ping"
        />
      )}
      {(pvcHealth === "warning" ||
        (timeToOomSeconds !== undefined && timeToOomSeconds < 3600)) && (
        <circle cx="50" cy="55" r="10" fill="#fbbf24" />
      )}
    </svg>
  );

  if (!showTooltip || health === "disconnected") {
    return triangle;
  }

  const statusInfo = healthLabels[health];

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-pointer">{triangle}</div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={8}
          className="bg-popover border border-border rounded-lg shadow-2xl p-0 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border bg-muted">
            <p className="font-semibold text-sm text-foreground truncate max-w-[200px]">
              {name}
            </p>
            <p className={cn("text-xs font-medium", statusInfo.color)}>
              {statusInfo.label}
            </p>
          </div>
          <div className="px-3 py-2 space-y-1.5">
            {cpu === 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 mb-1">
                <span className="text-base"></span>
                <span className="italic">Sleeping pod (idle)</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-muted-foreground">CPU</span>
              <span className={cn(
                "font-mono font-medium",
                cpu === 0 ? "text-muted-foreground" : "text-primary"
              )}>
                {cpu.toFixed(1)}m
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-muted-foreground">Memory</span>
              <span className="text-primary font-mono font-medium">
                {(memory / 1024 / 1024).toFixed(0)}Mi
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-muted-foreground">Restarts</span>
              <span
                className={cn(
                  "font-mono font-medium",
                  restarts > 0 ? "text-warning" : "text-muted-foreground",
                )}
              >
                {restarts}
              </span>
            </div>

            {timeToOomSeconds !== undefined && timeToOomSeconds < 3600 && (
              <div className="flex items-center justify-between gap-4 text-xs font-medium text-destructive animate-pulse">
                <span>OOM Risk</span>
                <span>
                  In {Math.floor(timeToOomSeconds / 60)}m{" "}
                  {Math.floor(timeToOomSeconds % 60)}s
                </span>
              </div>
            )}

            {pvcs && pvcs.length > 0 && (
              <>
                <div className="h-px bg-border/50 my-1" />
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Volumes
                  </p>
                  {pvcs.map((pvc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 text-[10px]"
                    >
                      <span className="text-muted-foreground truncate max-w-[100px]">
                        {pvc.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              pvc.health === "critical"
                                ? "bg-red-500"
                                : pvc.health === "warning"
                                  ? "bg-yellow-500"
                                  : "bg-green-500",
                            )}
                            style={{
                              width: `${Math.min(100, pvc.usagePercent)}%`,
                            }}
                          />
                        </div>
                        <span
                          className={cn(
                            "font-mono font-medium min-w-[24px] text-right",
                            pvc.health === "critical"
                              ? "text-destructive"
                              : pvc.health === "warning"
                                ? "text-warning"
                                : "text-success",
                          )}
                        >
                          {Math.round(pvc.usagePercent)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
