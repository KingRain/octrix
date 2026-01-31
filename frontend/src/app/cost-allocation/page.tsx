"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Loader2,
  DollarSign,
  Server,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Info,
  Flame,
  Snowflake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

interface NodeUtil {
  nodeName: string;
  cpuUtilPct: number;
  memUtilPct: number;
  status: "underutilized" | "healthy" | "hot" | "unknown";
  estimatedCostPerHour?: number;
}

interface CostInsight {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  evidence: string[];
}

interface DataQuality {
  hasPrometheus: boolean;
  mode: "real-usage" | "container-fallback" | "requests-fallback" | "unavailable";
}

interface OperationalCostRiskData {
  runRatePerHour: number | null;
  nodeCount: number;
  underutilizedNodeCount: number;
  hotNodeCount: number;
  costRiskLevel: "low" | "medium" | "high";
  nodes: NodeUtil[];
  insights: CostInsight[];
  generatedAt: string;
  dataQuality: DataQuality;
}

type SortField = "nodeName" | "cpuUtilPct" | "memUtilPct" | "status";
type SortDirection = "asc" | "desc";

export default function OperationalCostRiskPage() {
  const [data, setData] = useState<OperationalCostRiskData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/costs/operational-risk`);
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch operational cost risk data:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortedNodes = (): NodeUtil[] => {
    if (!data?.nodes) return [];

    return [...data.nodes].sort((a, b) => {
      const statusOrder = { underutilized: 0, healthy: 1, hot: 2, unknown: 3 };
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
        case "status":
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  };

  const getStatusBadge = (status: NodeUtil["status"]) => {
    switch (status) {
      case "underutilized":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
            <Snowflake className="w-3 h-3 mr-1" />
            Underutilized
          </Badge>
        );
      case "healthy":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Healthy
          </Badge>
        );
      case "hot":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
            <Flame className="w-3 h-3 mr-1" />
            Hot
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/30">
            Unknown
          </Badge>
        );
    }
  };

  const getRiskLevelBadge = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "low":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-lg px-4 py-1">
            Low Risk
          </Badge>
        );
      case "medium":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-lg px-4 py-1">
            Medium Risk
          </Badge>
        );
      case "high":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-lg px-4 py-1">
            High Risk
          </Badge>
        );
    }
  };

  const getDataQualityBadge = (quality: DataQuality) => {
    switch (quality.mode) {
      case "real-usage":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">
            Real Usage Data
          </Badge>
        );
      case "container-fallback":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-xs">
            Container Fallback
          </Badge>
        );
      case "requests-fallback":
        return (
          <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-xs">
            Requests Fallback
          </Badge>
        );
      case "unavailable":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-xs">
            Data Unavailable
          </Badge>
        );
    }
  };

  const getInsightIcon = (severity: CostInsight["severity"]) => {
    switch (severity) {
      case "high":
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case "medium":
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case "low":
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-4 h-4 ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1" />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading operational cost risk data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operational Cost Risk</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cluster cost run-rate estimate and node utilization analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data?.dataQuality && getDataQualityBadge(data.dataQuality)}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Section A: KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Estimated Run-Rate */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Estimated Run-Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data?.runRatePerHour !== null && data?.runRatePerHour !== undefined
                ? `₹${data.runRatePerHour.toFixed(2)}/hr`
                : "Not configured"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Estimate based on node count ({data?.nodeCount || 0} nodes)
            </p>
          </CardContent>
        </Card>

        {/* Underutilized Nodes */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Server className="w-4 h-4" />
              Underutilized Nodes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              <span className={data?.underutilizedNodeCount ? "text-blue-400" : ""}>
                {data?.underutilizedNodeCount || 0}
              </span>
              <span className="text-muted-foreground text-lg font-normal">
                {" "}/ {data?.nodeCount || 0}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Nodes below 20% CPU and memory utilization
            </p>
          </CardContent>
        </Card>

        {/* Cost Risk Level */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Cost Risk Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mt-1">
              {data?.costRiskLevel && getRiskLevelBadge(data.costRiskLevel)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Based on utilization patterns and hot nodes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Section B: Node Utilization Table */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Node Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50">
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
                      CPU Used %
                      {getSortIcon("cpuUtilPct")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("memUtilPct")}
                  >
                    <div className="flex items-center justify-end">
                      Memory Used %
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
                      <span
                        className={cn(
                          node.cpuUtilPct < 20
                            ? "text-blue-400"
                            : node.cpuUtilPct > 85
                            ? "text-red-400"
                            : "text-foreground"
                        )}
                      >
                        {node.cpuUtilPct.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          node.memUtilPct < 20
                            ? "text-blue-400"
                            : node.memUtilPct > 85
                            ? "text-red-400"
                            : "text-foreground"
                        )}
                      >
                        {node.memUtilPct.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(node.status)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {node.estimatedCostPerHour !== undefined
                        ? `₹${node.estimatedCostPerHour.toFixed(2)}`
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {getSortedNodes().length === 0 && (
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

      {/* Section C: Cost Insights */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Cost Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data?.insights && data.insights.length > 0 ? (
              data.insights.map((insight) => (
                <div
                  key={insight.id}
                  className={cn(
                    "p-4 rounded-lg border",
                    insight.severity === "high"
                      ? "bg-red-500/5 border-red-500/20"
                      : insight.severity === "medium"
                      ? "bg-yellow-500/5 border-yellow-500/20"
                      : "bg-blue-500/5 border-blue-500/20"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {getInsightIcon(insight.severity)}
                    <div className="flex-1">
                      <h4 className="font-semibold">{insight.title}</h4>
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

      {/* Footer with timestamp */}
      {data?.generatedAt && (
        <p className="text-xs text-muted-foreground text-center">
          Last updated: {new Date(data.generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
