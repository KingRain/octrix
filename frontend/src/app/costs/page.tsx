"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Server,
  Cpu,
  HardDrive,
  TrendingDown,
  TrendingUp,
  DollarSign,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  LineChart,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { cn } from "@/lib/utils";
import { useNodeUtilization } from "@/hooks/use-node-utilization";
import { NodeUtilizationSection } from "@/components/costs/node-utilization-section";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

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

function formatCurrency(value: number, currency: string = "₹"): string {
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

  const {
    data: nodeUtilizationData,
    refetch: refetchNodeUtil,
  } = useNodeUtilization();

  const fetchCostData = async () => {
    try {
      setIsLoading(true);

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

      {/* Main Tabs */}
      <Tabs defaultValue="resource-costs" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="resource-costs" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Resource Costs
          </TabsTrigger>
          <TabsTrigger value="cost-analysis" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Cost Analysis
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Resource Costs - Node utilization and cluster metrics */}
        <TabsContent value="resource-costs" className="space-y-6">
          {/* Summary Metrics Cards */}
          <div className="grid gap-4 grid-cols-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Server className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Total Nodes</p>
                </div>
                <p className="text-3xl font-semibold text-foreground">
                  {nodeUtilizationData?.summary.totalNodes || 0}
                </p>
                {nodeUtilizationData && nodeUtilizationData.summary.runRatePerHour > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ₹{nodeUtilizationData.summary.runRatePerHour.toFixed(2)}/hr run-rate
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Cpu className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Avg CPU Utilization</p>
                </div>
                <p className="text-3xl font-semibold text-foreground">
                  {nodeUtilizationData?.summary.avgCpuUtil.toFixed(1) || 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  P90: {nodeUtilizationData?.summary.p90CpuUtil.toFixed(1) || 0}%
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <HardDrive className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Avg Memory Utilization</p>
                </div>
                <p className="text-3xl font-semibold text-foreground">
                  {nodeUtilizationData?.summary.avgMemUtil.toFixed(1) || 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  P90: {nodeUtilizationData?.summary.p90MemUtil.toFixed(1) || 0}%
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Node Health</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-semibold text-foreground">
                    {nodeUtilizationData?.summary.healthyNodes || 0}
                  </p>
                  <span className="text-sm text-muted-foreground">healthy</span>
                </div>
                <div className="flex gap-3 mt-1 text-xs">
                  {nodeUtilizationData && nodeUtilizationData.summary.underutilizedNodes > 0 && (
                    <span className="text-blue-500">
                      {nodeUtilizationData.summary.underutilizedNodes} underutilized
                    </span>
                  )}
                  {nodeUtilizationData && nodeUtilizationData.summary.saturatedNodes > 0 && (
                    <span className="text-red-500">
                      {nodeUtilizationData.summary.saturatedNodes} saturated
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Node Utilization Table */}
          {nodeUtilizationData && (
            <NodeUtilizationSection
              nodes={nodeUtilizationData.nodes}
              summary={nodeUtilizationData.summary}
              insights={nodeUtilizationData.insights}
              dataQuality={nodeUtilizationData.dataQuality}
              showOnlyUtilization={true}
            />
          )}

          {!nodeUtilizationData && (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No node utilization data available</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ensure Prometheus is connected and collecting metrics
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Cost Analysis - Trends, savings, and optimization issues */}
        <TabsContent value="cost-analysis" className="space-y-6">
          {/* Cost Metrics Summary */}
          <div className="grid gap-4 grid-cols-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Cost Before Optimization</p>
                </div>
                <p className="text-3xl font-semibold text-foreground">
                  {formatRupees(metrics.estimatedCostBefore)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Cost After Optimization</p>
                </div>
                <p className="text-3xl font-semibold text-foreground">
                  {formatRupees(metrics.estimatedCostAfter)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-4 h-4 text-green-500" />
                  <p className="text-xs text-muted-foreground">Total Saved</p>
                </div>
                <p className="text-3xl font-semibold text-green-500">
                  {formatRupees(metrics.totalCostSaved)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  via {metrics.scaleDownCount} scale-down actions
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <p className="text-xs text-muted-foreground">Total Incurred</p>
                </div>
                <p className="text-3xl font-semibold text-amber-500">
                  {formatRupees(metrics.totalCostIncurred)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  via {metrics.scaleUpCount} scale-up actions
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cost Trend Chart */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Cost Trend Over Time</CardTitle>
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                  {metrics.optimizationPercent}% optimized
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
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
              <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-4 bg-blue-500 rounded" />
                  <span className="text-xs text-muted-foreground">Cost Before Actions</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-4 bg-emerald-500 rounded" />
                  <span className="text-xs text-muted-foreground">Cost After Actions</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost Savings Breakdown */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Cost Savings Breakdown</h2>
              <span className="text-sm text-muted-foreground">
                Primary Driver: <span className="text-primary font-medium">{primaryCostDriver}</span>
              </span>
            </div>

            {/* Avoidable Cost Banner */}
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg py-3 px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-green-500" />
                <span className="text-green-600 font-medium">
                  Total Avoidable Cost: {formatRupees(totalAvoidableCost)} / month
                </span>
              </div>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                {issues.filter(i => i.status === "optimized").length} / {issues.length} optimized
              </Badge>
            </div>

            {/* Issue Cards Grid */}
            <div className="grid gap-4 grid-cols-2">
              {issues.map((issue) => (
                <Card
                  key={issue.id}
                  className={cn(
                    "border transition-all duration-200 hover:border-opacity-60",
                    issue.status === "optimized"
                      ? "bg-card border-green-500/20"
                      : "bg-card border-border",
                  )}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-medium text-foreground">{issue.title}</h3>
                      <Badge
                        className={cn(
                          "text-xs font-medium px-2 py-0.5",
                          issue.status === "active" &&
                            "bg-green-500/20 text-green-600 border-green-500/30",
                          issue.status === "optimized" &&
                            "bg-blue-500/20 text-blue-600 border-blue-500/30",
                          issue.status === "pending" &&
                            "bg-amber-500/20 text-amber-600 border-amber-500/30",
                        )}
                      >
                        {issue.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Monthly Cost Impact
                      </p>
                      <p className="text-2xl font-semibold text-foreground">
                        {formatRupees(issue.monthlyCostImpact)}
                      </p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-3">
                        <span className="text-muted-foreground w-12 shrink-0">Cause:</span>
                        <span className="text-muted-foreground">{issue.cause}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-muted-foreground w-12 shrink-0">Scope:</span>
                        <span className="text-muted-foreground">{issue.scope}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-muted-foreground w-12 shrink-0">Fix:</span>
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

          {/* Cost Optimization Insights from Node Data */}
          {nodeUtilizationData && nodeUtilizationData.insights.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Optimization Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {nodeUtilizationData.insights.map((insight) => (
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
                        <AlertCircle
                          className={cn(
                            "w-5 h-5 mt-0.5",
                            insight.severity === "high"
                              ? "text-red-500"
                              : insight.severity === "medium"
                              ? "text-yellow-500"
                              : "text-blue-500"
                          )}
                        />
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
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
