"use client";

import { useState, useEffect } from "react";
import {
  TrendingDown,
  TrendingUp,
  ExternalLink,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Server,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  LineChart,
  Bar,
  BarChart,
  Cell,
} from "recharts";
import Link from "next/link";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

interface NodeMetrics {
  nodeName: string;
  cpuUsagePercent: number;
  cpuUsedCores: number;
  cpuTotalCores: number;
  memoryUsagePercent: number;
  memoryUsageBytes: number;
  memoryTotalBytes: number;
  podCount: number;
  uptimeSeconds: number;
}

interface CostMetrics {
  estimatedCostBefore: number;
  estimatedCostAfter: number;
  totalCostSaved: number;
  totalCostIncurred: number;
  scaleDownCount: number;
  scaleUpCount: number;
  optimizationPercent: number;
}

interface CostIssue {
  id: string;
  title: string;
  status: "active" | "optimized" | "pending";
  monthlyCostImpact: number;
  cause: string;
  scope: string;
  fix: string;
  fixUrl?: string;
  severity: "high" | "medium" | "low";
  category: string;
}

interface TrendDataPoint {
  date: string;
  before: number;
  after: number;
}

interface CostSummary {
  metrics: CostMetrics;
  totalAvoidableCost: number;
  primaryCostDriver: string;
  issues: CostIssue[];
  trends: TrendDataPoint[];
}

function formatCurrency(value: number, currency: string = "$"): string {
  if (value >= 1000) {
    return `${currency}${(value / 1000).toFixed(1)}k`;
  }
  return `${currency}${value.toFixed(2)}`;
}

function formatRupees(value: number): string {
  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}k`;
  }
  return `₹${value.toFixed(0)}`;
}

export default function CostsPage() {
  const [deployment, setDeployment] = useState("all");
  const [action, setAction] = useState("all");
  const [timeRange, setTimeRange] = useState("7d");
  const [isLoading, setIsLoading] = useState(true);
  const [costData, setCostData] = useState<CostSummary | null>(null);
  const [efficiencyData, setEfficiencyData] = useState<
    Array<{ date: string; value: number }>
  >([]);
  const [minicubeNode, setMinicubeNode] = useState<NodeMetrics | null>(null);

  const {
    data: nodeUtilizationData,
    isLoading: nodeUtilLoading,
    refetch: refetchNodeUtil,
  } = useNodeUtilization();

  const fetchCostData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch minicube node data
      const nodesRes = await fetch(`${BACKEND_URL}/api/v1/cluster/nodes`);
      const nodesData = await nodesRes.json();
      
      if (nodesData.success && nodesData.data && nodesData.data.length > 0) {
        const minicubeNode = nodesData.data.find((node: NodeMetrics) =>
          node.nodeName.toLowerCase().includes('minikube') ||
          node.nodeName.toLowerCase().includes('minicube')
        );
        setMinicubeNode(minicubeNode || null);
      }

      const response = await fetch(`${BACKEND_URL}/api/v1/costs/summary`);
      const data = await response.json();

      if (data.success && data.data) {
        setCostData(data.data);

        // Generate efficiency chart data
        const effData = data.data.trends.map(
          (t: TrendDataPoint, idx: number) => ({
            date: t.date,
            value: Math.round((t.after / t.before) * 100),
          }),
        );
        setEfficiencyData(effData);
      }
    } catch (error) {
      console.error("Failed to fetch cost data:", error);
      // Don't use fallback data - let the page show empty state
      setCostData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCostData();
    const interval = setInterval(fetchCostData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!costData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-muted-foreground">Unable to load cost data</p>
          <p className="text-sm text-muted-foreground mt-1">
            Please ensure the backend is running and try refreshing
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          fetchCostData();
          refetchNodeUtil();
        }}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  const { metrics, totalAvoidableCost, primaryCostDriver, issues, trends } =
    costData;

  return (
    <div className="space-y-6 bg-transparent min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Cost & Efficiency
          </h1>
          <p className="text-sm text-muted-foreground">
            Cost insights and resource optimization overview.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCostData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={deployment} onValueChange={setDeployment}>
          <SelectTrigger className="w-[160px] bg-background border-border h-9">
            <SelectValue placeholder="Deployment: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Deployment: All</SelectItem>
            <SelectItem value="api-gateway">api-gateway</SelectItem>
            <SelectItem value="user-service">user-service</SelectItem>
            <SelectItem value="order-processor">order-processor</SelectItem>
          </SelectContent>
        </Select>

        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-[140px] bg-background border-border h-9">
            <SelectValue placeholder="Action: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Action: All</SelectItem>
            <SelectItem value="scale-down">Scale Down</SelectItem>
            <SelectItem value="scale-up">Scale Up</SelectItem>
          </SelectContent>
        </Select>

        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[140px] bg-background border-border h-9">
            <SelectValue placeholder="Time Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Metrics Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Summary Metrics</h2>
        <span className="text-sm text-success font-medium">
          {metrics.optimizationPercent}% from optimizations
        </span>
      </div>

      {/* Minicube Node Stats */}
      {minicubeNode && (
        <div className="bg-white rounded-xl border border-blue-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-medium text-gray-900">Minicube Node Stats</h2>
            <span className="text-xs text-gray-500 ml-2">
              Primary cluster node
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">CPU Usage</p>
              <p className="text-2xl font-semibold text-foreground">
                {minicubeNode.cpuUsagePercent.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {minicubeNode.cpuUsedCores.toFixed(3)} / {minicubeNode.cpuTotalCores.toFixed(1)} cores
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Memory Usage</p>
              <p className="text-2xl font-semibold text-foreground">
                {minicubeNode.memoryUsagePercent.toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {(minicubeNode.memoryUsageBytes / (1024 * 1024 * 1024)).toFixed(1)} GB / {(minicubeNode.memoryTotalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Pods on Node</p>
              <p className="text-2xl font-semibold text-foreground">
                {minicubeNode.podCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Total pods running on minicube
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Minicube Node Stats */}
      {minicubeNode && (
        <div className="bg-white rounded-xl border border-blue-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-medium text-gray-900">Minicube Node Stats</h2>
            <span className="text-xs text-gray-500 ml-2">
              Primary cluster node
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">CPU Usage</p>
              <p className="text-2xl font-semibold text-foreground">
                {minicubeNode.cpuUsagePercent.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {minicubeNode.cpuUsedCores.toFixed(3)} / {minicubeNode.cpuTotalCores.toFixed(1)} cores
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Memory Usage</p>
              <p className="text-2xl font-semibold text-foreground">
                {minicubeNode.memoryUsagePercent.toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {(minicubeNode.memoryUsageBytes / (1024 * 1024 * 1024)).toFixed(1)} GB / {(minicubeNode.memoryTotalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Pods on Node</p>
              <p className="text-2xl font-semibold text-foreground">
                {minicubeNode.podCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Total pods running on minicube
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Metrics Cards */}
      <div className="grid gap-4 grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">
              Estimated Cost Before
            </p>
            <p className="text-3xl font-semibold text-foreground">
              {formatRupees(metrics.estimatedCostBefore)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">
              Estimated Cost After
            </p>
            <p className="text-3xl font-semibold text-foreground">
              {formatRupees(metrics.estimatedCostAfter)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">
              Total Cost Saved
            </p>
            <p className="text-3xl font-semibold text-success">
              {formatRupees(metrics.totalCostSaved)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              via {metrics.scaleDownCount} scale-down actions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">
              Total Cost Incurred
            </p>
            <p className="text-3xl font-semibold text-warning">
              {formatRupees(metrics.totalCostIncurred)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              via {metrics.scaleUpCount} scale-up actions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Savings Breakdown Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Cost Savings Breakdown</h2>

        {/* Avoidable Cost Banner */}
        <div className="bg-muted border border-border rounded-lg py-3 px-4 flex items-center justify-between">
          <span className="text-success font-medium">
            Total Avoidable Cost: {formatRupees(totalAvoidableCost)} / month
          </span>
          <span className="text-sm text-muted-foreground">
            Primary Cost Driver:{" "}
            <span className="text-primary">{primaryCostDriver}</span>
          </span>
        </div>

        {/* Issue Cards Grid */}
        <div className="grid gap-4 grid-cols-2">
          {issues.map((issue) => (
            <Card
              key={issue.id}
              className={cn(
                "border transition-all duration-200 hover:border-opacity-60",
                issue.status === "optimized"
                  ? "bg-card border-success/20"
                  : "bg-card border-border",
              )}
            >
              <CardContent className="p-5">
                {/* Header with title and status */}
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-medium text-foreground">{issue.title}</h3>
                  <Badge
                    className={cn(
                      "text-xs font-medium px-2 py-0.5",
                      issue.status === "active" &&
                        "bg-success/20 text-success border-success/30",
                      issue.status === "optimized" &&
                        "bg-primary/20 text-primary border-primary/30",
                      issue.status === "pending" &&
                        "bg-warning/20 text-warning border-warning/30",
                    )}
                  >
                    {issue.status.toUpperCase()}
                  </Badge>
                </div>

                {/* Monthly Cost Impact */}
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Monthly Cost Impact
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    {formatRupees(issue.monthlyCostImpact)}
                  </p>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-muted-foreground w-12 shrink-0">
                      Cause:
                    </span>
                    <span className="text-muted-foreground">{issue.cause}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-muted-foreground w-12 shrink-0">
                      Scope:
                    </span>
                    <span className="text-muted-foreground">{issue.scope}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-muted-foreground w-12 shrink-0">
                      Fix:
                    </span>
                    {issue.fixUrl ? (
                      <Link
                        href={issue.fixUrl}
                        className="text-primary hover:text-primary/80 hover:underline transition-colors"
                      >
                        {issue.fix}
                      </Link>
                    ) : (
                      <span className="text-primary">{issue.fix}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Charts Section */}
      <div className="space-y-4">
        {/* Cost Trend Chart - Full width */}
        <h2 className="text-lg font-medium">Cost Trend Over Time</h2>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                  />
                  <YAxis hide domain={["dataMin - 20", "dataMax + 20"]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "8px 12px",
                    }}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                    formatter={(value: number, name: string) => [
                      `₹${value.toFixed(2)}`,
                      name === "before"
                        ? "Before Optimization"
                        : "After Optimization",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="before"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    name="before"
                  />
                  <Line
                    type="monotone"
                    dataKey="after"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    name="after"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-4 bg-blue-500 rounded" />
                <span className="text-xs text-muted-foreground">
                  Cost Before Actions
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-4 bg-emerald-500 rounded" />
                <span className="text-xs text-muted-foreground">
                  Cost After Actions
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
