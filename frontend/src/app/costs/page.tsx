"use client";

import { useState } from "react";
import {
  TrendingDown,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ArrowUpFromLine,
  Circle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  ReferenceDot,
} from "recharts";

const costSavingsData = [
  { date: "04/16", before: 180, after: 175 },
  { date: "04/19", before: 175, after: 170 },
  { date: "04/20", before: 172, after: 165 },
  { date: "04/21", before: 165, after: 120 },
  { date: "04/22", before: 120, after: 115 },
  { date: "04/23", before: 115, after: 110 },
  { date: "04/25", before: 110, after: 105 },
  { date: "04/23", before: 105, after: 100 },
  { date: "04/24", before: 100, after: 95 },
];

const efficiencyTrendsData = [
  { date: "04/18", value: 82 },
  { date: "04/16", value: 90 },
  { date: "04/23", value: 78 },
  { date: "04/22", value: 72 },
  { date: "04/16", value: 25 },
  { date: "04/03", value: 340 },
  { date: "04/14", value: 340 },
];

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

export default function CostsPage() {
  const [deployment, setDeployment] = useState("all");
  const [action, setAction] = useState("all");
  const [timeRange, setTimeRange] = useState("7d");

  const estimatedCostBefore = 152.30;
  const estimatedCostAfter = 137.50;
  const totalCostSaved = 475.90;
  const totalCostIncurred = 86.10;
  const scaleDownSavings = 514.40;
  const scaleDownCount = 29;
  const scaleUpCosts = 38.50;
  const scaleUpCount = 17;
  const netSavings = 475.90;
  const optimizationPercent = -9.6;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cost & Efficiency</h1>
        <p className="text-sm text-muted-foreground">
          Cost insights and resource optimization overview.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={deployment} onValueChange={setDeployment}>
          <SelectTrigger className="w-[160px] bg-[#1a2332] border-[#2a3a4a]">
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
          <SelectTrigger className="w-[140px] bg-[#1a2332] border-[#2a3a4a]">
            <SelectValue placeholder="Action: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Action: All</SelectItem>
            <SelectItem value="scale-down">Scale Down</SelectItem>
            <SelectItem value="scale-up">Scale Up</SelectItem>
          </SelectContent>
        </Select>

        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px] bg-[#1a2332] border-[#2a3a4a]">
            <SelectValue placeholder="Time Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Summary Metrics</h2>
        <span className="text-sm text-green-400">{optimizationPercent}% from optimizations</span>
      </div>

      <div className="grid gap-4 grid-cols-4">
        <Card className="bg-[#0d1520] border-[#1a2a3a]">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Estimated Cost Before</p>
            <p className="text-3xl font-semibold text-white">${estimatedCostBefore.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0d1520] border-[#1a2a3a]">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Estimated Cost After</p>
            <p className="text-3xl font-semibold text-white">${estimatedCostAfter.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0d1520] border-[#1a2a3a]">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Total Cost Saved</p>
            <p className="text-3xl font-semibold text-green-400">
              ${totalCostSaved.toFixed(2)} <TrendingUp className="inline h-4 w-4" />
            </p>
            <p className="text-xs text-muted-foreground">via {scaleDownCount} scale-down actions</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0d1520] border-[#1a2a3a]">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Total Cost Incurred</p>
            <p className="text-3xl font-semibold text-orange-400">${totalCostIncurred.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">via {scaleUpCount} scale-up actions</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-medium">Cost Savings Breakdown</h2>
          
          <div className="grid gap-4 grid-cols-2">
            <Card className="bg-[#0d1520] border-[#1a2a3a]">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Circle className="h-3 w-3 fill-green-500 text-green-500" />
                  <span className="text-sm text-muted-foreground">Scale Down Savings</span>
                  <TrendingDown className="h-4 w-4 text-muted-foreground ml-auto" />
                </div>
                <p className="text-3xl font-semibold text-green-400">${scaleDownSavings.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">+{scaleDownCount} scale-downs</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0d1520] border-[#1a2a3a]">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-3 w-3 border-2 border-blue-400 rounded-sm" />
                  <span className="text-sm text-muted-foreground">Scale Up Costs</span>
                  <ArrowUpFromLine className="h-4 w-4 text-muted-foreground ml-auto" />
                </div>
                <p className="text-3xl font-semibold text-blue-400">${scaleUpCosts.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">+{scaleUpCount} scale-ups</p>
              </CardContent>
            </Card>
          </div>

          <div className="bg-[#0a1a15] border border-[#1a3a2a] rounded-lg py-3 px-4 text-center">
            <span className="text-green-400 font-semibold text-lg">${netSavings.toFixed(2)}</span>
            <span className="text-muted-foreground ml-2">net savings</span>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-medium">Efficiency Trends</h2>
          <Card className="bg-[#0d1520] border-[#1a2a3a] h-[200px]">
            <CardContent className="p-4 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={efficiencyTrendsData}>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Bar 
                    dataKey="value" 
                    fill="#22c55e" 
                    radius={[2, 2, 0, 0]}
                    maxBarSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Cost Savings Breakdown</h2>
        <Card className="bg-[#0d1520] border-[#1a2a3a]">
          <CardContent className="p-4">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={costSavingsData}>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={{ stroke: "#2a3a4a" }}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a2332",
                      border: "1px solid #2a3a4a",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="before"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    name="Cost Before Actions"
                  />
                  <Line
                    type="monotone"
                    dataKey="after"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    name="Cost After Actions"
                  />
                  <ReferenceDot x="04/20" y={165} r={8} fill="#eab308" stroke="none" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>Over-provisioning Optimized</span>
            </div>
            <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-[#2a3a4a]">
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-4 bg-blue-500" />
                <span className="text-xs text-muted-foreground">Cost Before Actions</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-4 bg-green-500" />
                <span className="text-xs text-muted-foreground">Cost After Actions</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
