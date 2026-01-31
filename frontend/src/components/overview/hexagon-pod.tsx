"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type PodHealth = "healthy" | "healing" | "failed" | "pending" | "unknown" | "disconnected";

interface HexagonPodProps {
  name: string;
  health: PodHealth;
  cpu: number;
  memory: number;
  restarts: number;
  size?: number;
  showTooltip?: boolean;
}

const healthColors: Record<PodHealth, string> = {
  healthy: "fill-green-500",
  healing: "fill-yellow-500",
  failed: "fill-red-500",
  pending: "fill-blue-400",
  unknown: "fill-gray-500",
  disconnected: "fill-gray-600",
};

const healthBgColors: Record<PodHealth, string> = {
  healthy: "bg-green-500/20",
  healing: "bg-yellow-500/20",
  failed: "bg-red-500/20",
  pending: "bg-blue-400/20",
  unknown: "bg-gray-500/20",
  disconnected: "bg-gray-600/20",
};

export function HexagonPod({
  name,
  health,
  cpu,
  memory,
  restarts,
  size = 24,
  showTooltip = true,
}: HexagonPodProps) {
  const hexagon = (
    <svg
      width={size}
      height={size * 1.1547}
      viewBox="0 0 100 115.47"
      className={cn(
        "transition-all duration-200",
        health === "healing" && "animate-pulse",
        health !== "disconnected" && "hover:brightness-110"
      )}
    >
      <polygon
        points="50,0 100,28.87 100,86.6 50,115.47 0,86.6 0,28.87"
        className={cn(
          healthColors[health],
          "stroke-[#1a1a1a] stroke-3 transition-colors"
        )}
      />
    </svg>
  );

  if (!showTooltip || health === "disconnected") {
    return hexagon;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-pointer">{hexagon}</div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className={cn("border", healthBgColors[health])}
        >
          <div className="space-y-1">
            <p className="font-medium text-sm">{name}</p>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>CPU: {cpu.toFixed(1)}m</p>
              <p>Memory: {(memory / 1024 / 1024).toFixed(0)}Mi</p>
              <p>Restarts: {restarts}</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
