"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Box, RotateCcw, Cpu, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

interface PodNodeData {
  label: string;
  namespace: string;
  status: string;
  nodeName: string;
  restarts: number;
  cpuUsage: number;
  memoryUsage: number;
}

interface PodNodeProps {
  data: PodNodeData;
  selected: boolean;
}

function getStatusColor(status: string) {
  switch (status) {
    case "running":
      return "border-green-500/50 bg-green-500/5";
    case "pending":
      return "border-yellow-500/50 bg-yellow-500/5";
    case "failed":
      return "border-red-500/50 bg-red-500/5";
    default:
      return "border-muted bg-muted/5";
  }
}

function getStatusDotColor(status: string) {
  switch (status) {
    case "running":
      return "bg-green-500";
    case "pending":
      return "bg-yellow-500";
    case "failed":
      return "bg-red-500";
    default:
      return "bg-muted-foreground";
  }
}

export const PodNode = memo(function PodNode({ data, selected }: PodNodeProps) {
  return (
    <div
      className={cn(
        "min-w-[180px] rounded-lg border-2 bg-card p-3 shadow-lg transition-all",
        getStatusColor(data.status),
        selected && "ring-2 ring-primary"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-muted-foreground !border-background !w-2 !h-2"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10">
          <Box className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{data.label}</p>
          <p className="text-[10px] text-muted-foreground">{data.namespace}</p>
        </div>
        <div className={cn("h-2 w-2 rounded-full", getStatusDotColor(data.status))} />
      </div>

      <div className="space-y-1 text-[10px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Cpu className="h-3 w-3" />
            CPU
          </span>
          <span>{data.cpuUsage}m</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            Memory
          </span>
          <span>{data.memoryUsage}Mi</span>
        </div>
        {data.restarts > 0 && (
          <div className="flex items-center justify-between text-yellow-500">
            <span className="flex items-center gap-1">
              <RotateCcw className="h-3 w-3" />
              Restarts
            </span>
            <span>{data.restarts}</span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-muted-foreground !border-background !w-2 !h-2"
      />
    </div>
  );
});
