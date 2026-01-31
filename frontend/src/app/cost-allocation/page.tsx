"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw,
  Loader2,
  Download,
  ChevronDown,
  ArrowDown,
  Cpu,
  HardDrive,
  Zap,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { type CheckedState } from "@radix-ui/react-checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
} from "@/components/ui/chart";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

// Types
interface CostDataPoint {
  date: string;
  cpu: number;
  gpu: number;
  ram: number;
  pv: number;
  idle: number;
}

interface CostBreakdownItem {
  name: string;
  cpu: number;
  gpu: number;
  ram: number;
  pv: number;
  efficiency: string;
  totalCost: number;
}

interface CostAllocationData {
  chartData: CostDataPoint[];
  breakdown: CostBreakdownItem[];
  totals: {
    cpu: number;
    gpu: number;
    ram: number;
    pv: number;
    efficiency: string;
    totalCost: number;
  };
}

// Dummy data generator
function generateDummyData(
  breakdown: string,
  dateRange: string,
  includeIdle: boolean,
): CostAllocationData {
  // Generate chart data for the last 7 days
  const today = new Date();
  const chartData: CostDataPoint[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

    chartData.push({
      date: dateStr,
      cpu: 60 + Math.random() * 20,
      gpu: 0,
      ram: 20 + Math.random() * 10,
      pv: 2 + Math.random() * 3,
      idle: includeIdle ? 30 + Math.random() * 15 : 0,
    });
  }

  // Generate breakdown data based on selected breakdown type
  const breakdownData: Record<string, CostBreakdownItem[]> = {
    namespace: [
      {
        name: "__idle__",
        cpu: 145.79,
        gpu: 0.0,
        ram: 100.38,
        pv: 0.0,
        efficiency: "—",
        totalCost: 246.17,
      },
      {
        name: "prometheus-system",
        cpu: 13.7,
        gpu: 0.0,
        ram: 0.95,
        pv: 0.25,
        efficiency: "5.8%",
        totalCost: 14.91,
      },
      {
        name: "kube-system",
        cpu: 11.32,
        gpu: 0.0,
        ram: 0.7,
        pv: 0.0,
        efficiency: "8.6%",
        totalCost: 12.04,
      },
      {
        name: "load-generator",
        cpu: 10.04,
        gpu: 0.0,
        ram: 0.41,
        pv: 0.0,
        efficiency: "57.2%",
        totalCost: 10.77,
      },
      {
        name: "network-load-gen",
        cpu: 1.63,
        gpu: 0.0,
        ram: 0.22,
        pv: 2.06,
        efficiency: "4.1%",
        totalCost: 3.91,
      },
      {
        name: "ingress-nginx",
        cpu: 0.4,
        gpu: 0.0,
        ram: 0.03,
        pv: 0.0,
        efficiency: "9.1%",
        totalCost: 2.12,
      },
      {
        name: "gpu-operator",
        cpu: 1.37,
        gpu: 0.0,
        ram: 0.61,
        pv: 0.0,
        efficiency: "101.6%",
        totalCost: 1.99,
      },
      {
        name: "network-costs",
        cpu: 1.0,
        gpu: 0.0,
        ram: 0.02,
        pv: 0.0,
        efficiency: "22.1%",
        totalCost: 1.03,
      },
      {
        name: "iperf-demo",
        cpu: 0.54,
        gpu: 0.0,
        ram: 0.03,
        pv: 0.0,
        efficiency: "114%",
        totalCost: 0.57,
      },
      {
        name: "argo",
        cpu: 0.07,
        gpu: 0.0,
        ram: 0.3,
        pv: 0.0,
        efficiency: "Inf%",
        totalCost: 0.38,
      },
      {
        name: "opencost",
        cpu: 0.1,
        gpu: 0.0,
        ram: 0.06,
        pv: 0.0,
        efficiency: "94.3%",
        totalCost: 0.16,
      },
    ],
    "controller-kind": [
      {
        name: "Deployment",
        cpu: 120.5,
        gpu: 0.0,
        ram: 85.2,
        pv: 1.5,
        efficiency: "42.5%",
        totalCost: 207.2,
      },
      {
        name: "DaemonSet",
        cpu: 45.3,
        gpu: 0.0,
        ram: 12.1,
        pv: 0.0,
        efficiency: "38.2%",
        totalCost: 57.4,
      },
      {
        name: "StatefulSet",
        cpu: 22.1,
        gpu: 0.0,
        ram: 8.5,
        pv: 0.8,
        efficiency: "65.4%",
        totalCost: 31.4,
      },
      {
        name: "Job",
        cpu: 8.2,
        gpu: 0.0,
        ram: 2.1,
        pv: 0.0,
        efficiency: "88.1%",
        totalCost: 10.3,
      },
      {
        name: "ReplicaSet",
        cpu: 6.8,
        gpu: 0.0,
        ram: 1.9,
        pv: 0.0,
        efficiency: "72.3%",
        totalCost: 8.7,
      },
    ],
    cluster: [
      {
        name: "production-cluster",
        cpu: 180.2,
        gpu: 0.0,
        ram: 95.5,
        pv: 2.0,
        efficiency: "52.1%",
        totalCost: 277.7,
      },
      {
        name: "staging-cluster",
        cpu: 45.6,
        gpu: 0.0,
        ram: 12.3,
        pv: 0.31,
        efficiency: "38.5%",
        totalCost: 58.21,
      },
    ],
    node: [
      {
        name: "node-pool-1-abc123",
        cpu: 95.4,
        gpu: 0.0,
        ram: 48.2,
        pv: 1.2,
        efficiency: "48.2%",
        totalCost: 144.8,
      },
      {
        name: "node-pool-1-def456",
        cpu: 88.2,
        gpu: 0.0,
        ram: 42.1,
        pv: 0.8,
        efficiency: "52.1%",
        totalCost: 131.1,
      },
      {
        name: "node-pool-2-ghi789",
        cpu: 42.2,
        gpu: 0.0,
        ram: 17.5,
        pv: 0.31,
        efficiency: "41.8%",
        totalCost: 60.01,
      },
    ],
  };

  const breakdown_items =
    breakdownData[breakdown] || breakdownData["namespace"];

  // Filter out idle if not included
  const filteredBreakdown = includeIdle
    ? breakdown_items
    : breakdown_items.filter((item) => item.name !== "__idle__");

  // Calculate totals
  const totals = filteredBreakdown.reduce(
    (acc, item) => ({
      cpu: acc.cpu + item.cpu,
      gpu: acc.gpu + item.gpu,
      ram: acc.ram + item.ram,
      pv: acc.pv + item.pv,
      totalCost: acc.totalCost + item.totalCost,
    }),
    { cpu: 0, gpu: 0, ram: 0, pv: 0, totalCost: 0 },
  );

  return {
    chartData,
    breakdown: filteredBreakdown,
    totals: {
      ...totals,
      efficiency: "61.9%",
    },
  };
}

function formatCurrency(value: number, currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    INR: "₹",
  };
  const symbol = symbols[currency] || "₹";
  return `${symbol}${value.toFixed(2)}`;
}

// Custom tooltip for the chart
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium mb-2 text-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="text-foreground font-medium">
              ₹{entry.value.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function CostAllocationPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [includeIdleCosts, setIncludeIdleCosts] = useState(true);
  const [dateRange, setDateRange] = useState("last-7-days");
  const [breakdown, setBreakdown] = useState("namespace");
  const [resolution, setResolution] = useState("daily");
  const [currency, setCurrency] = useState("INR");
  const [data, setData] = useState<CostAllocationData | null>(null);
  const [sortColumn, setSortColumn] = useState<string>("totalCost");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const breakdownOptions = [
    { value: "cluster", label: "Cluster" },
    { value: "node", label: "Node" },
    { value: "namespace", label: "Namespace" },
    { value: "controller-kind", label: "Controller Kind" },
    { value: "controller", label: "Controller" },
    { value: "daemonset", label: "DaemonSet" },
    { value: "deployment", label: "Deployment" },
    { value: "job", label: "Job" },
    { value: "service", label: "Service" },
    { value: "statefulset", label: "StatefulSet" },
    { value: "pod", label: "Pod" },
    { value: "container", label: "Container" },
  ];

  const dateRangeOptions = [
    { value: "last-24-hours", label: "Last 24 hours" },
    { value: "last-7-days", label: "Last 7 days" },
    { value: "last-30-days", label: "Last 30 days" },
    { value: "last-90-days", label: "Last 90 days" },
  ];

  const resolutionOptions = [
    { value: "hourly", label: "Hourly" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
  ];

  const currencyOptions = [
    { value: "USD", label: "USD" },
    { value: "EUR", label: "EUR" },
    { value: "GBP", label: "GBP" },
    { value: "INR", label: "INR" },
  ];

  const fetchData = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      const newData = generateDummyData(breakdown, dateRange, includeIdleCosts);
      setData(newData);
      setIsLoading(false);
    }, 500);
  };

  useEffect(() => {
    fetchData();
  }, [breakdown, dateRange, resolution, includeIdleCosts]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const sortedBreakdown = data?.breakdown.slice().sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;

    switch (sortColumn) {
      case "name":
        aVal = a.name;
        bVal = b.name;
        break;
      case "cpu":
        aVal = a.cpu;
        bVal = b.cpu;
        break;
      case "gpu":
        aVal = a.gpu;
        bVal = b.gpu;
        break;
      case "ram":
        aVal = a.ram;
        bVal = b.ram;
        break;
      case "pv":
        aVal = a.pv;
        bVal = b.pv;
        break;
      case "efficiency":
        aVal = parseFloat(a.efficiency) || 0;
        bVal = parseFloat(b.efficiency) || 0;
        break;
      case "totalCost":
      default:
        aVal = a.totalCost;
        bVal = b.totalCost;
        break;
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

  const selectedBreakdownLabel =
    breakdownOptions.find((opt) => opt.value === breakdown)?.label ||
    "Namespace";

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-transparent min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Cost Allocation
        </h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-idle"
              checked={includeIdleCosts}
              onCheckedChange={(checked: CheckedState) =>
                setIncludeIdleCosts(checked === true)
              }
              className="border-gray-500"
            />
            <label
              htmlFor="include-idle"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Include idle costs
            </label>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchData}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-card border border-border rounded-lg p-6">
        {/* Chart Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="space-y-1">
            <h2 className="text-lg font-medium">
              {dateRange === "last-7-days" ? "Last 7 days" : dateRange} by{" "}
              {selectedBreakdownLabel.toLowerCase()} {resolution}
            </h2>
            <p className="text-sm text-primary">
              <span className="cursor-pointer hover:underline">
                All Results
              </span>
              {breakdown === "namespace" && (
                <span className="text-muted-foreground">
                  {" > "}
                  <span className="cursor-pointer hover:underline">
                    sealed-secrets
                  </span>
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              by {selectedBreakdownLabel}
            </p>
          </div>

          {/* Filter Controls */}
          <div className="flex items-center gap-3">
            {/* Date Range */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Date Range
              </label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px] bg-background border-border h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Breakdown */}
            <div className="space-y-1">
              <label className="text-xs text-primary">Breakdown</label>
              <Select value={breakdown} onValueChange={setBreakdown}>
                <SelectTrigger className="w-[160px] bg-background border-border h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {breakdownOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Resolution */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Resolution
              </label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger className="w-[120px] bg-background border-border h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resolutionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Currency */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Currency</label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-[100px] bg-background border-border h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Download Button */}
            <div className="space-y-1 pt-4">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Stacked Bar Chart */}
        <ChartContainer config={{
          cpu: {
            label: "CPU",
            icon: Cpu,
            color: "#3b82f6",
          },
          gpu: {
            label: "GPU",
            icon: Cpu,
            color: "#22c55e",
          },
          ram: {
            label: "RAM",
            icon: HardDrive,
            color: "#f59e0b",
          },
          pv: {
            label: "PV",
            icon: Zap,
            color: "#ef4444",
          },
          idle: {
            label: "Idle",
            icon: Clock,
            color: "#9ca3af",
          },
        }}>
          <BarChart data={data?.chartData} barCategoryGap="15%">
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => value.toFixed(0)}
            />
            <ChartTooltip content={<CustomTooltip />} />
            {includeIdleCosts && (
              <Bar dataKey="idle" stackId="a" name="Idle" />
            )}
          </BarChart>
        </ChartContainer>

        {/* Table Header */}
        <div className="border-t border-border pt-4">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead
                  className="text-muted-foreground font-medium cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    Name
                    {sortColumn === "name" && (
                      <ArrowDown
                        className={cn(
                          "h-3 w-3",
                          sortDirection === "asc" && "rotate-180",
                        )}
                      />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="text-right text-muted-foreground font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("cpu")}
                >
                  <div className="flex items-center justify-end gap-1">
                    CPU
                    {sortColumn === "cpu" && (
                      <ArrowDown
                        className={cn(
                          "h-3 w-3",
                          sortDirection === "asc" && "rotate-180",
                        )}
                      />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="text-right text-muted-foreground font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("gpu")}
                >
                  <div className="flex items-center justify-end gap-1">
                    GPU
                    {sortColumn === "gpu" && (
                      <ArrowDown
                        className={cn(
                          "h-3 w-3",
                          sortDirection === "asc" && "rotate-180",
                        )}
                      />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="text-right text-muted-foreground font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("ram")}
                >
                  <div className="flex items-center justify-end gap-1">
                    RAM
                    {sortColumn === "ram" && (
                      <ArrowDown
                        className={cn(
                          "h-3 w-3",
                          sortDirection === "asc" && "rotate-180",
                        )}
                      />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="text-right text-muted-foreground font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("pv")}
                >
                  <div className="flex items-center justify-end gap-1">
                    PV
                    {sortColumn === "pv" && (
                      <ArrowDown
                        className={cn(
                          "h-3 w-3",
                          sortDirection === "asc" && "rotate-180",
                        )}
                      />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="text-right text-muted-foreground font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("efficiency")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Efficiency
                    {sortColumn === "efficiency" && (
                      <ArrowDown
                        className={cn(
                          "h-3 w-3",
                          sortDirection === "asc" && "rotate-180",
                        )}
                      />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="text-right text-muted-foreground font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("totalCost")}
                >
                  <div className="flex items-center justify-end gap-1">
                    <ArrowDown
                      className={cn(
                        "h-3 w-3",
                        sortColumn === "totalCost" && sortDirection === "asc"
                          ? "rotate-180"
                          : "",
                      )}
                    />
                    Total cost
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Totals Row */}
              {data?.totals && (
                <TableRow className="border-b border-border bg-muted/50 font-medium">
                  <TableCell className="text-foreground">Totals</TableCell>
                  <TableCell className="text-right text-foreground">
                    {formatCurrency(data.totals.cpu, currency)}
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {formatCurrency(data.totals.gpu, currency)}
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {formatCurrency(data.totals.ram, currency)}
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {formatCurrency(data.totals.pv, currency)}
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {data.totals.efficiency}
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {formatCurrency(data.totals.totalCost, currency)}
                  </TableCell>
                </TableRow>
              )}

              {/* Individual Items */}
              {sortedBreakdown?.map((item, index) => (
                <TableRow
                  key={item.name}
                  className={cn(
                    "border-b border-border hover:bg-muted transition-colors",
                    item.name === "__idle__" && "text-muted-foreground",
                  )}
                >
                  <TableCell
                    className={cn(
                      item.name === "__idle__"
                        ? "text-muted-foreground"
                        : "text-foreground",
                    )}
                  >
                    {item.name}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.cpu, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.gpu, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.ram, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.pv, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.efficiency}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground font-medium">
                    {formatCurrency(item.totalCost, currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
