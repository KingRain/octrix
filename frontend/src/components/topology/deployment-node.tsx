"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeploymentNodeData {
  label: string;
  namespace: string;
  replicas: number;
  availableReplicas: number;
  status: string;
}

interface DeploymentNodeProps {
  data: DeploymentNodeData;
  selected: boolean;
}

export const DeploymentNode = memo(function DeploymentNode({
  data,
  selected,
}: DeploymentNodeProps) {
  const isHealthy = data.availableReplicas === data.replicas;

  return (
    <div
      className={cn(
        "min-w-[180px] rounded-lg border-2 p-3 shadow-lg transition-all",
        isHealthy
          ? "border-purple-500/50 bg-purple-500/5"
          : "border-yellow-500/50 bg-yellow-500/5",
        selected && "ring-2 ring-primary"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="bg-purple-500! border-background! w-2! h-2!"
      />

      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded",
            isHealthy ? "bg-purple-500/10" : "bg-yellow-500/10"
          )}
        >
          <Layers
            className={cn(
              "h-3.5 w-3.5",
              isHealthy ? "text-purple-500" : "text-yellow-500"
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{data.label}</p>
          <p className="text-[10px] text-muted-foreground">{data.namespace}</p>
        </div>
      </div>

      <div className="space-y-1 text-[10px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Replicas</span>
          <span
            className={cn(
              "font-medium",
              isHealthy ? "text-green-500" : "text-yellow-500"
            )}
          >
            {data.availableReplicas}/{data.replicas}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isHealthy ? "bg-green-500" : "bg-yellow-500"
            )}
            style={{
              width: `${(data.availableReplicas / data.replicas) * 100}%`,
            }}
          />
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="bg-purple-500! border-background! w-2! h-2!"
      />
    </div>
  );
});
