"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Network } from "lucide-react";
import { cn } from "@/lib/utils";

interface ServicePort {
  name: string;
  port: number;
  targetPort: number;
  protocol: string;
}

interface ServiceNodeData {
  label: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: ServicePort[];
}

interface ServiceNodeProps {
  data: ServiceNodeData;
  selected: boolean;
}

export const ServiceNode = memo(function ServiceNode({
  data,
  selected,
}: ServiceNodeProps) {
  return (
    <div
      className={cn(
        "min-w-[180px] rounded-lg border-2 border-blue-500/50 bg-blue-500/5 p-3 shadow-lg transition-all",
        selected && "ring-2 ring-primary"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-blue-500 !border-background !w-2 !h-2"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-500/10">
          <Network className="h-3.5 w-3.5 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{data.label}</p>
          <p className="text-[10px] text-muted-foreground">{data.namespace}</p>
        </div>
      </div>

      <div className="space-y-1 text-[10px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Type</span>
          <span className="font-medium text-foreground">{data.type}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Cluster IP</span>
          <span className="font-mono">{data.clusterIP}</span>
        </div>
        {data.ports.length > 0 && (
          <div className="flex items-center justify-between">
            <span>Ports</span>
            <span className="font-mono">
              {data.ports.map((p) => `${p.port}`).join(", ")}
            </span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-500 !border-background !w-2 !h-2"
      />
    </div>
  );
});
