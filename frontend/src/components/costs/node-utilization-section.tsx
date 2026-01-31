"use client";

import { useState } from "react";
import {
  Server,
  Cpu,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Snowflake,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  AlertCircle,
  DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  NodeUtilData,
  ClusterSummary,
  CostInsight,
} from "@/hooks/use-node-utilization";

interface NodeUtilizationSectionProps {
  nodes: NodeUtilData[];
  summary: ClusterSummary;
  insights: CostInsight[];
  dataQuality: {
    hasPrometheus: boolean;
    mode: "real-usage" | "container-fallback" | "unavailable";
  };
  showOnlyUtilization?: boolean;
}

type SortField = "nodeName" | "cpuUtilPct" | "memUtilPct" | "wasteScore" | "status";
type SortDirection = "asc" | "desc";

export function NodeUtilizationSection({
  nodes,
  summary,
  insights,
  dataQuality,
  showOnlyUtilization = false,
}: NodeUtilizationSectionProps) {
  const [sortField, setSortField] = useState<SortField>("wasteScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "wasteScore" ? "desc" : "asc");
    }
  };

  const getSortedNodes = (): NodeUtilData[] => {
    return [...nodes].sort((a, b) => {
      const statusOrder = { underutilized: 0, healthy: 1, saturated: 2 };
      let comparison = 0;

      switch (sortField) {
        case "nodeName":
          comparison = a.nodeName.localeCompare(b.nodeName);
          break;
        case "cpuUtilPct":
          comparison = a.cpuUtilPct - b.cpuUtilPct;
          break;
        case "memUtilPct":
          comparison = a.memUtilPct - b.memUtilPct;
          break;
        case "wasteScore":
          comparison = a.wasteScore - b.wasteScore;
          break;
        case "status":
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  };

  const getStatusBadge = (status: NodeUtilData["status"]) => {
    switch (status) {
      case "underutilized":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
            <Snowflake className="w-3 h-3 mr-1" />
            Underutilized
          </Badge>
        );
      case "healthy":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Healthy
          </Badge>
        );
      case "saturated":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            <Flame className="w-3 h-3 mr-1" />
            Saturated
          </Badge>
        );
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    );
  };

  const getInsightIcon = (severity: CostInsight["severity"]) => {
    switch (severity) {
      case "high":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case "medium":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "low":
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getDataQualityBadge = () => {
    switch (dataQuality.mode) {
      case "real-usage":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
            Real Usage Data
          </Badge>
        );
      case "container-fallback":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-xs">
            Container Fallback
          </Badge>
        );
      case "unavailable":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 text-xs">
            Data Unavailable
          </Badge>
        );
    }
  };

  const formatBytes = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Node Utilization Details</h2>
          <p className="text-sm text-muted-foreground">
            CPU and memory utilization per node
          </p>
        </div>
        {getDataQualityBadge()}
      </div>

      {/* Node Utilization Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Node Utilization Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("nodeName")}
                  >
                    <div className="flex items-center">
                      Node Name
                      {getSortIcon("nodeName")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("cpuUtilPct")}
                  >
                    <div className="flex items-center justify-end">
                      CPU Used / Capacity
                      {getSortIcon("cpuUtilPct")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("memUtilPct")}
                  >
                    <div className="flex items-center justify-end">
                      Mem Used / Capacity
                      {getSortIcon("memUtilPct")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center">
                      Status
                      {getSortIcon("status")}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Est. ₹/hr</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getSortedNodes().map((node) => (
                  <TableRow key={node.nodeName}>
                    <TableCell className="font-medium">{node.nodeName}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span
                          className={cn(
                            "font-medium",
                            node.cpuUtilPct < 20
                              ? "text-blue-600"
                              : node.cpuUtilPct > 85
                              ? "text-red-600"
                              : "text-foreground"
                          )}
                        >
                          {node.cpuUtilPct.toFixed(1)}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {node.cpuUsedCores.toFixed(2)} / {node.cpuCapacityCores.toFixed(1)} cores
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span
                          className={cn(
                            "font-medium",
                            node.memUtilPct < 20
                              ? "text-blue-600"
                              : node.memUtilPct > 85
                              ? "text-red-600"
                              : "text-foreground"
                          )}
                        >
                          {node.memUtilPct.toFixed(1)}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(node.memUsedBytes)} / {formatBytes(node.memCapacityBytes)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(node.status)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ₹{node.estimatedCostPerHour.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                {nodes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No node data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Cost Optimization Insights */}
      {!showOnlyUtilization && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cost Optimization Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.length > 0 ? (
                insights.map((insight) => (
                  <div
                    key={insight.id}
                    className={cn(
                      "p-4 rounded-lg border",
                      insight.severity === "high"
                        ? "bg-red-50 border-red-200 dark:bg-red-500/5 dark:border-red-500/20"
                        : insight.severity === "medium"
                        ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-500/5 dark:border-yellow-500/20"
                        : "bg-blue-50 border-blue-200 dark:bg-blue-500/5 dark:border-blue-500/20"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {getInsightIcon(insight.severity)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-foreground">{insight.title}</h4>
                          {insight.potentialSavings !== undefined && insight.potentialSavings > 0 && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                              <DollarSign className="w-3 h-3 mr-1" />
                              ~₹{insight.potentialSavings.toFixed(2)}/hr savings
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{insight.detail}</p>
                        {insight.evidence && insight.evidence.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {insight.evidence.map((item, idx) => (
                              <li
                                key={idx}
                                className="text-xs text-muted-foreground flex items-center gap-2"
                              >
                                <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No insights available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
