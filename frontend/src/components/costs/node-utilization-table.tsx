"use client";

import { useState } from "react";
import { ArrowUpDown, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NodeUtilization } from "@/hooks/use-node-utilization";

interface NodeUtilizationTableProps {
  nodes: NodeUtilization[];
}

type SortField = "nodeName" | "cpuUtilPercent" | "memUtilPercent" | "wasteScore" | "status";
type SortDirection = "asc" | "desc";

export function NodeUtilizationTable({ nodes }: NodeUtilizationTableProps) {
  const [sortField, setSortField] = useState<SortField>("wasteScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedNodes = [...nodes].sort((a, b) => {
    let aVal: number | string = a[sortField];
    let bVal: number | string = b[sortField];

    if (sortField === "status") {
      const statusOrder = { saturated: 3, healthy: 2, underutilized: 1 };
      aVal = statusOrder[a.status];
      bVal = statusOrder[b.status];
    }

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return sortDirection === "asc"
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const formatBytes = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const getStatusBadge = (status: NodeUtilization["status"]) => {
    switch (status) {
      case "underutilized":
        return (
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">
            Underutilized
          </Badge>
        );
      case "saturated":
        return (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30 text-xs">
            Saturated
          </Badge>
        );
      default:
        return (
          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-xs">
            Healthy
          </Badge>
        );
    }
  };

  const getUtilColor = (percent: number): string => {
    if (percent < 20) return "bg-amber-500";
    if (percent > 85) return "bg-red-500";
    return "bg-emerald-500";
  };

  const UtilizationBar = ({ value, colorClass }: { value: number; colorClass: string }) => (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div
        className={cn("h-full transition-all", colorClass)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );

  const SortButton = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 -ml-2 font-medium text-muted-foreground hover:text-foreground"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown
        className={cn(
          "ml-1 h-3 w-3",
          sortField === field && "text-primary"
        )}
      />
    </Button>
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Server className="h-5 w-5 text-muted-foreground" />
          Node Utilization
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2">
                  <SortButton field="nodeName">Node Name</SortButton>
                </th>
                <th className="text-left py-3 px-2">
                  <SortButton field="cpuUtilPercent">CPU</SortButton>
                </th>
                <th className="text-left py-3 px-2">
                  <SortButton field="memUtilPercent">Memory</SortButton>
                </th>
                <th className="text-left py-3 px-2">
                  <SortButton field="status">Status</SortButton>
                </th>
                <th className="text-right py-3 px-2">
                  <span className="text-xs text-muted-foreground font-medium">
                    Est. $/hr
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedNodes.map((node) => (
                <tr
                  key={node.nodeName}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 px-2">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm text-foreground">
                        {node.nodeName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {node.podCount} pods
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="space-y-1 min-w-[140px]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {node.cpuUsedCores.toFixed(2)} / {node.cpuCapacityCores.toFixed(1)} cores
                        </span>
                        <span className="font-medium">
                          {node.cpuUtilPercent.toFixed(1)}%
                        </span>
                      </div>
                      <UtilizationBar
                        value={node.cpuUtilPercent}
                        colorClass={getUtilColor(node.cpuUtilPercent)}
                      />
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="space-y-1 min-w-[140px]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {formatBytes(node.memUsedBytes)} / {formatBytes(node.memCapacityBytes)}
                        </span>
                        <span className="font-medium">
                          {node.memUtilPercent.toFixed(1)}%
                        </span>
                      </div>
                      <UtilizationBar
                        value={node.memUtilPercent}
                        colorClass={getUtilColor(node.memUtilPercent)}
                      />
                    </div>
                  </td>
                  <td className="py-3 px-2">{getStatusBadge(node.status)}</td>
                  <td className="py-3 px-2 text-right">
                    <span className="text-sm text-muted-foreground">
                      ${node.estimatedHourlyCost.toFixed(3)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
