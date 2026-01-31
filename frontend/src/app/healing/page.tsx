"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ChevronDown,
  Loader2,
  TrendingDown,
  Zap,
  MemoryStick,
  RotateCcw,
  Filter,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

interface HealingActivity {
  id: string;
  ruleId: string;
  ruleName: string;
  timestamp: string;
  status: "success" | "failed" | "in-progress" | "skipped";
  targetResource: string;
  targetNamespace: string;
  action: string;
  details: string;
  duration: number;
  trigger?: string;
  outcome?: string;
  actionLabel?: string;
  fromReplicas?: number;
  toReplicas?: number;
}

interface HealingStats {
  avgRecoveryTime: number;
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  skippedActions: number;
  improvementPercent: number;
  beforeAITime: number;
  withAutoHealTime: number;
}

type FilterType = "all" | "cpu" | "memory" | "restarts";

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = now - time;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} mins ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) > 1 ? "s" : ""} ago`;
}

function formatDuration(ms: number): { value: string; unit: string } {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (minutes > 0) {
    return { value: `${minutes}m`, unit: `${seconds}s` };
  }
  return { value: `${seconds}s`, unit: "" };
}

function ActivityCard({ activity, isExpanded, onToggle }: { 
  activity: HealingActivity; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const getActionIcon = () => {
    switch (activity.actionLabel || activity.ruleName) {
      case "Scale Up":
        return <ArrowUpRight className="h-4 w-4" />;
      case "Scale Down":
        return <ArrowDownRight className="h-4 w-4" />;
      case "Patch Limits":
        return <MemoryStick className="h-4 w-4" />;
      case "Restart Pod":
        return <RotateCcw className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (activity.status) {
      case "success":
        return "text-success";
      case "failed":
        return "text-destructive";
      case "skipped":
        return "text-warning";
      default:
        return "text-primary";
    }
  };

  const getBadgeColor = () => {
    switch (activity.actionLabel || activity.ruleName) {
      case "Scale Up":
        return "bg-success/20 text-success border-success/30";
      case "Scale Down":
        return "bg-warning/20 text-warning border-warning/30";
      case "Patch Limits":
        return "bg-primary/20 text-primary border-primary/30";
      case "Restart Pod":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-muted/20 text-muted-foreground border-muted/30";
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg border", getBadgeColor())}>
            {getActionIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", getBadgeColor())}>
                {activity.actionLabel || activity.ruleName}
              </span>
              <span className="text-sm text-muted-foreground">
                Triggered by <span className="text-foreground font-medium">{activity.trigger}</span>
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={onToggle}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {formatRelativeTime(activity.timestamp)}
          <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
        </button>
      </div>

      <div className="space-y-2 text-sm">
        {activity.fromReplicas !== undefined && activity.toReplicas !== undefined && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowUpRight className="h-4 w-4" />
            <span>
              Scaled {activity.actionLabel === "Scale Down" ? "down" : "up"} replicas from{" "}
              <span className="text-foreground font-medium">{activity.fromReplicas}</span> to{" "}
              <span className="text-foreground font-medium">{activity.toReplicas}</span>
            </span>
          </div>
        )}
        
        {activity.details && !activity.fromReplicas && (
          <div className="flex items-center gap-2 text-muted-foreground">
            {activity.actionLabel === "Patch Limits" ? (
              <MemoryStick className="h-4 w-4" />
            ) : activity.actionLabel === "Restart Pod" ? (
              <RotateCcw className="h-4 w-4" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            <span>
              {activity.actionLabel === "Restart Pod" 
                ? `Attempted pod restart on `
                : activity.actionLabel === "Patch Limits"
                ? `Increased memory limit to `
                : ""}
              <span className="text-foreground font-medium">
                {activity.actionLabel === "Restart Pod" 
                  ? activity.targetResource
                  : activity.actionLabel === "Patch Limits"
                  ? "256Mi"
                  : activity.details}
              </span>
            </span>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-muted-foreground">
          <Zap className="h-4 w-4" />
          <span>
            Outcome: <span className={cn("font-medium", getStatusColor())}>
              {activity.outcome || (activity.status === "success" ? "Success" : activity.status === "failed" ? "Failed" : "Skipped")}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function HealingPage() {
  const [activity, setActivity] = useState<HealingActivity[]>([]);
  const [stats, setStats] = useState<HealingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const [activityRes, statsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/healing/activity?filter=${activeFilter}`),
        fetch(`${BACKEND_URL}/api/v1/healing/stats`),
      ]);

      if (!activityRes.ok || !statsRes.ok) {
        throw new Error("Failed to fetch healing data");
      }

      const activityData = await activityRes.json();
      const statsData = await statsRes.json();

      if (mountedRef.current) {
        if (activityData.success) {
          setActivity(activityData.data);
        }
        if (statsData.success) {
          setStats(statsData.data);
        }
        setError(null);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError("Failed to connect to backend");
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [activeFilter]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    const pollInterval = setInterval(fetchData, 10000);

    return () => {
      mountedRef.current = false;
      clearInterval(pollInterval);
    };
  }, [fetchData]);

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All Actions" },
    { key: "cpu", label: "CPU" },
    { key: "memory", label: "Memory" },
    { key: "restarts", label: "Restarts" },
  ];

  const avgTime = stats ? formatDuration(stats.avgRecoveryTime || 252000) : { value: "4m", unit: "32s" };
  const beforeAIMinutes = stats ? Math.round(stats.beforeAITime / 60000) : 15;
  const withAutoHealMinutes = stats ? Math.round(stats.withAutoHealTime / 60000) : 4;
  const improvementPercent = stats?.improvementPercent || 73;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <span className="text-gray-400">Loading healing data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-3 text-center">
          <XCircle className="h-8 w-8 text-red-500" />
          <span className="text-gray-400">{error}</span>
          <button 
            onClick={fetchData} 
            className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2 inline" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-transparent min-h-screen p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Auto-Healing</h1>
          <p className="text-sm text-muted-foreground">
            Automated remediation actions and system recovery logs.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Status: All</span>
          <Filter className="h-4 w-4" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {filters.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
              activeFilter === filter.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            {filter.label}
            {activeFilter === filter.key && <ChevronDown className="h-4 w-4" />}
          </button>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-medium text-foreground mb-4">Auto-Healing Activity</h2>
        <div className="space-y-3">
          {activity.length > 0 ? (
            activity.map((item) => (
              <ActivityCard
                key={item.id}
                activity={item}
                isExpanded={expandedCards.has(item.id)}
                onToggle={() => toggleCard(item.id)}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No healing activity found</p>
              <p className="text-xs mt-1">Activity will appear when auto-healing actions are triggered</p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-border">
        <h2 className="text-lg font-medium text-foreground mb-4">MTTR Reduction</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <p className="text-sm text-muted-foreground mb-2">Avg Recovery Time</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">{avgTime.value}</span>
              <span className="text-2xl text-muted-foreground">{avgTime.unit}</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-success text-sm">
              <TrendingDown className="h-4 w-4" />
              <span>{improvementPercent}% improvement</span>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <p className="text-sm text-muted-foreground mb-4">Impact Analysis</p>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Before AI</p>
                <p className="text-2xl font-bold text-muted-foreground">{beforeAIMinutes} min</p>
              </div>
              
              <ChevronsRight className="h-6 w-6 text-muted-foreground" />
              
              <div className="flex-1 bg-gradient-to-r from-primary to-cyan-500 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-primary-foreground">With Auto-Heal</p>
                    <p className="text-2xl font-bold text-foreground">{withAutoHealMinutes} min</p>
                  </div>
                  <span className="px-2 py-1 bg-cyan-400/20 text-cyan-300 text-xs rounded-full">
                    New Standard
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
