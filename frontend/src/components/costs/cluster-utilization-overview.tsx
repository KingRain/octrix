"use client";

import { Cpu, HardDrive, Server, AlertTriangle, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ClusterUtilizationSummary } from "@/hooks/use-node-utilization";

interface ClusterUtilizationOverviewProps {
  summary: ClusterUtilizationSummary;
}

export function ClusterUtilizationOverview({
  summary,
}: ClusterUtilizationOverviewProps) {
  const formatCurrency = (value: number): string => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Cluster Utilization Overview</h2>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Server className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">Total Nodes</p>
            </div>
            <p className="text-3xl font-semibold text-foreground">
              {summary.totalNodes}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.totalCpuCores.toFixed(1)} cores · {(summary.totalMemoryBytes / (1024 * 1024 * 1024)).toFixed(1)} GB
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Cpu className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-xs text-muted-foreground">Avg CPU Utilization</p>
            </div>
            <p className="text-3xl font-semibold text-foreground">
              {summary.avgCpuUtil.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              p90: {summary.p90CpuUtil.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <HardDrive className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-xs text-muted-foreground">Avg Memory Utilization</p>
            </div>
            <p className="text-3xl font-semibold text-foreground">
              {summary.avgMemUtil.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              p90: {summary.p90MemUtil.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-xs text-muted-foreground">Underutilized Nodes</p>
            </div>
            <p className="text-3xl font-semibold text-foreground">
              {summary.underutilizedNodes}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.saturatedNodes > 0
                ? `${summary.saturatedNodes} saturated`
                : "0 saturated"}
            </p>
          </CardContent>
        </Card>
      </div>

      {summary.estimatedHourlyRunRate > 0 && (
        <Card className="bg-muted/50 border-border">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Estimated Run Rate:
              </span>
              <span className="text-sm font-medium text-foreground">
                {formatCurrency(summary.estimatedHourlyRunRate)}/hr
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              ~{formatCurrency(summary.estimatedMonthlyCost)}/month
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
