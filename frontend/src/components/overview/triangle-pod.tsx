"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type PodHealth = "healthy" | "healing" | "failed" | "pending" | "unknown" | "disconnected";

interface TrianglePodProps {
  name: string;
  health: PodHealth;
  cpu: number;
  memory: number;
  restarts: number;
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
  healthy: { label: "Healthy", color: "text-green-400" },
  healing: { label: "Healing", color: "text-yellow-400" },
  failed: { label: "Failed", color: "text-red-400" },
  pending: { label: "Pending", color: "text-blue-400" },
  unknown: { label: "Unknown", color: "text-gray-400" },
  disconnected: { label: "Disconnected", color: "text-gray-500" },
};

export function TrianglePod({
  name,
  health,
  cpu,
  memory,
  restarts,
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
        health !== "disconnected" && "hover:brightness-125 hover:scale-110"
      )}
    >
      <polygon
        points="50,0 100,86.6 0,86.6"
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="2"
        className="transition-colors"
      />
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
          className="bg-[#1a1a1a] border border-gray-600 rounded-lg shadow-2xl p-0 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-gray-700 bg-[#222]">
            <p className="font-semibold text-sm text-white truncate max-w-[200px]">{name}</p>
            <p className={cn("text-xs font-medium", statusInfo.color)}>{statusInfo.label}</p>
          </div>
          <div className="px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-gray-400">CPU</span>
              <span className="text-cyan-400 font-mono font-medium">{cpu.toFixed(1)}m</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-gray-400">Memory</span>
              <span className="text-purple-400 font-mono font-medium">{(memory / 1024 / 1024).toFixed(0)}Mi</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-gray-400">Restarts</span>
              <span className={cn("font-mono font-medium", restarts > 0 ? "text-orange-400" : "text-gray-300")}>{restarts}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
