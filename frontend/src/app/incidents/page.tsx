"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  HardDrive,
  RefreshCw,
  Server,
  Wifi,
  Settings,
  ChevronDown,
  ChevronRight,
  Loader2,
  Database,
  Bug,
  HelpCircle,
  Layers,
  Gauge,
  TrendingDown,
  ImageOff,
  XCircle,
  Terminal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useIncidents,
  type Incident,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentSummary,
  type SLOBurnDriver,
  type IncidentLogs,
} from "@/hooks/use-incidents";
import { cn } from "@/lib/utils";

const severityConfig: Record<
  IncidentSeverity,
  { color: string; icon: typeof AlertCircle }
> = {
  critical: { color: "text-red-500 bg-red-500/10", icon: AlertCircle },
  high: { color: "text-orange-500 bg-orange-500/10", icon: AlertTriangle },
  medium: { color: "text-yellow-500 bg-yellow-500/10", icon: AlertTriangle },
  low: { color: "text-blue-500 bg-blue-500/10", icon: AlertCircle },
};

const statusConfig: Record<IncidentStatus, { color: string; label: string }> = {
  open: {
    color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    label: "Open",
  },
  acknowledged: {
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    label: "Acknowledged",
  },
  healing: {
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    label: "Healing",
  },
  escalated: {
    color: "bg-red-500/10 text-red-500 border-red-500/20",
    label: "Escalated",
  },
  resolved: {
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    label: "Resolved",
  },
};

const categoryIcons: Record<string, typeof Cpu> = {
  "oom-killed": HardDrive,
  "high-cpu": Cpu,
  "high-memory": HardDrive,
  "crash-loop": RefreshCw,
  "pod-throttling": Gauge,
  underutilization: TrendingDown,
  "node-eviction": Server,
  "image-pull-delay": ImageOff,
  "buggy-deployment": Bug,
  "configmap-error": Settings,
  "db-failure": Database,
  "unknown-crash": HelpCircle,
  "multi-service-failure": Layers,
  "node-not-ready": Server,
  "node-pressure": Server,
};

const categoryLabels: Record<string, string> = {
  "oom-killed": "OOM Killed",
  "high-cpu": "High CPU",
  "high-memory": "High Memory",
  "crash-loop": "Crash Loop",
  "pod-throttling": "CPU Throttling",
  underutilization: "Underutilization",
  "node-eviction": "Node Eviction",
  "image-pull-delay": "Image Pull Delay",
  "buggy-deployment": "Buggy Deployment",
  "configmap-error": "Config Error",
  "db-failure": "DB Failure",
  "unknown-crash": "Unknown Crash",
  "multi-service-failure": "Multi-Service Failure",
  "node-not-ready": "Node Not Ready",
  "node-pressure": "Node Pressure",
};

const sloBurnDriverLabels: Record<SLOBurnDriver, string> = {
  "traffic-surge": "Traffic surge",
  degradation: "Degradation",
  mixed: "Mixed",
};

/**
 * Get SLO burn driver from incident, preferring backend classification
 * Falls back to category-based heuristics for backward compatibility
 */
function getSLOBurnDriver(incident: Incident): SLOBurnDriver {
  // Prefer dynamic classification from backend
  if (incident.sloBurnDriver) return incident.sloBurnDriver;

  // Fallback: category-based heuristics (backward compatibility)
  const category = incident.category;

  // Traffic-driven categories (resource pressure from load)
  const trafficCategories = ["high-cpu", "high-memory", "pod-throttling"];
  if (trafficCategories.includes(category)) {
    return "traffic-surge";
  }

  // Degradation-driven categories (bugs, crashes, failures)
  const degradationCategories = [
    "crash-loop",
    "oom-killed",
    "buggy-deployment",
    "configmap-error",
    "db-failure",
    "unknown-crash",
  ];
  if (degradationCategories.includes(category)) {
    return "degradation";
  }

  return "mixed";
}

/**
 * Get confidence badge color based on classification confidence
 */
function getConfidenceColor(confidence?: number): string {
  if (!confidence) return "text-muted-foreground";
  if (confidence >= 0.8) return "text-green-500";
  if (confidence >= 0.6) return "text-yellow-500";
  return "text-orange-500";
}

/**
 * Get evidence string from incident, preferring backend evidence
 * Falls back to metrics-based generation for backward compatibility
 */
function getEvidence(incident: Incident): string {
  // Prefer dynamic evidence from backend
  if (incident.sloBurnEvidence) return incident.sloBurnEvidence;

  // Legacy evidence field
  if (incident.evidence) return incident.evidence;

  // Fallback: generate from metrics (backward compatibility)
  const metrics = incident.metrics;
  const category = incident.category;

  const parts: string[] = [];

  // CPU evidence
  if (category === "high-cpu" || category === "pod-throttling") {
    if (metrics.cpuUsage) {
      parts.push(`CPU ${Math.round(Number(metrics.cpuUsage))}%`);
    } else {
      parts.push("CPU elevated");
    }
  }

  // Memory evidence
  if (category === "high-memory" || category === "oom-killed") {
    if (metrics.memoryUsage) {
      parts.push(`memory ${Math.round(Number(metrics.memoryUsage))}%`);
    } else {
      parts.push("memory elevated");
    }
  }

  // Restart evidence
  if (category === "crash-loop" || metrics.restartCount) {
    const restarts = metrics.restartCount;
    if (restarts) {
      parts.push(`${restarts} restarts`);
    }
  }

  // Error rate evidence
  if (metrics.errorRate) {
    parts.push(`error rate ${Number(metrics.errorRate).toFixed(1)}%`);
  }

  // OOM evidence
  if (metrics.oomKilled) {
    parts.push("OOM killed");
  }

  if (parts.length === 0) {
    // Generic fallback based on driver type
    const driver = getSLOBurnDriver(incident);
    if (driver === "traffic-surge") {
      return "Resource pressure from load";
    } else if (driver === "degradation") {
      return "Quality degradation detected";
    }
    return "Multiple contributing factors";
  }

  return parts.join(", ");
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildHighlightTokens(signals?: string[]): string[] {
  if (!signals || signals.length === 0) return [];
  const stopwords = new Set([
    "the",
    "and",
    "from",
    "with",
    "that",
    "this",
    "into",
    "for",
    "your",
    "pod",
    "pods",
    "event",
    "events",
    "severity",
    "category",
    "detected",
    "at",
    "in",
    "of",
    "to",
  ]);
  const tokens = new Set<string>();

  signals.forEach((signal) => {
    const normalized = signal
      .toLowerCase()
      .replace(/^(event|severity|category|detected at):\s*/i, "");
    normalized
      .split(/[^a-z0-9/_\-.]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !stopwords.has(token))
      .forEach((token) => tokens.add(token));
  });

  return Array.from(tokens);
}

function getDuration(incident: Incident): number {
  if (incident.resolvedAt) {
    return (
      new Date(incident.resolvedAt).getTime() -
      new Date(incident.detectedAt).getTime()
    );
  }
  return Date.now() - new Date(incident.detectedAt).getTime();
}

function IncidentCard({ incident }: { incident: Incident }) {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [logs, setLogs] = useState<IncidentLogs | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const { fetchIncidentSummary, fetchIncidentLogs } = useIncidents();
  const SeverityIcon = severityConfig[incident.severity]?.icon || AlertCircle;
  const CategoryIcon = categoryIcons[incident.category] || HelpCircle;
  const highlightTokens = useMemo(
    () => buildHighlightTokens(summary?.signals),
    [summary?.signals],
  );

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open && !summary && !isLoadingSummary) {
      setIsLoadingSummary(true);
      const summaryData = await fetchIncidentSummary(incident.id);
      setSummary(summaryData);
      setIsLoadingSummary(false);
    }
  };

  const handleLogsOpenChange = async (open: boolean) => {
    setIsLogsOpen(open);
    if (!open) return;
    if (logs || isLoadingLogs) return;

    setIsLoadingLogs(true);
    setLogsError(null);
    const logsData = await fetchIncidentLogs(incident.id);
    if (!logsData) {
      setLogsError("Unable to fetch logs for this incident.");
    } else {
      setLogs(logsData);
    }
    setIsLoadingLogs(false);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <Card className={cn("transition-all", isOpen && "ring-1 ring-border")}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    severityConfig[incident.severity]?.color ||
                      "bg-gray-500/10",
                  )}
                >
                  <SeverityIcon className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">
                      {incident.title}
                    </CardTitle>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CategoryIcon className="h-3 w-3" />
                    <span>
                      {categoryLabels[incident.category] || incident.category}
                    </span>
                    <span>-</span>
                    <span>{incident.resource}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-cyan-500 font-medium">
                      SLO burn driver:
                    </span>{" "}
                    <span>
                      {sloBurnDriverLabels[getSLOBurnDriver(incident)]}
                    </span>
                    {incident.sloBurnConfidence && (
                      <span
                        className={cn(
                          "ml-1",
                          getConfidenceColor(incident.sloBurnConfidence),
                        )}
                      >
                        ({Math.round(incident.sloBurnConfidence * 100)}%
                        confidence)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-amber-500 font-medium">
                      Evidence:
                    </span>{" "}
                    <span className="italic">
                      &quot;{getEvidence(incident)}&quot;
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={statusConfig[incident.status]?.color || ""}
                >
                  {statusConfig[incident.status]?.label || incident.status}
                </Badge>
                <div className="text-xs text-muted-foreground text-right">
                  <div>{formatTimestamp(incident.detectedAt)}</div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(getDuration(incident))}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {isLoadingSummary && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating AI-powered summary...</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Incident Summary
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLogsOpenChange(true)}
              >
                <Terminal className="mr-2 h-4 w-4" />
                View logs
              </Button>
            </div>

            {summary && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                <div className="space-y-1">
                  <div className="text-sm space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="font-medium">
                        Incident #{incident.id.slice(0, 8)}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Root suspect:</span>{" "}
                      {summary.rootSuspect}
                    </div>
                    <div>
                      <span className="font-medium">Impact:</span>{" "}
                      {summary.impact}
                    </div>
                    <div className="space-y-1">
                      <span className="font-medium">Signals:</span>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        {summary.signals.map((signal: string, idx: number) => (
                          <li key={idx} className="text-xs">
                            {signal}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <span className="font-medium">Classification:</span>{" "}
                        {summary.classification}
                      </div>
                      <div>
                        <span className="font-medium">Blast radius:</span>{" "}
                        {summary.blastRadius}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Generated at{" "}
                      {new Date(summary.generatedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Description
                </p>
                <p className="text-sm">{incident.description}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Suggested Action
                </p>
                <p className="text-sm">{incident.suggestedAction}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Namespace
                </p>
                <p className="text-sm">{incident.namespace}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Resource Type
                </p>
                <p className="text-sm capitalize">{incident.resourceType}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Auto-Healable
                </p>
                <Badge
                  variant="outline"
                  className={
                    incident.autoHealable
                      ? "bg-green-500/10 text-green-500"
                      : "bg-red-500/10 text-red-500"
                  }
                >
                  {incident.autoHealable ? "Yes" : "No"}
                </Badge>
              </div>
            </div>

            {incident.autoHealingAttempted && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Auto-Healing Result
                </p>
                <Badge
                  variant="outline"
                  className={
                    incident.autoHealingResult === "success"
                      ? "bg-green-500/10 text-green-500"
                      : incident.autoHealingResult === "failed"
                        ? "bg-red-500/10 text-red-500"
                        : "bg-yellow-500/10 text-yellow-500"
                  }
                >
                  {incident.autoHealingResult || "Pending"}
                </Badge>
              </div>
            )}

            {Object.keys(incident.metrics).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Metrics
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(incident.metrics).map(([key, value]) => (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {key}: {String(value)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>

      <Dialog open={isLogsOpen} onOpenChange={handleLogsOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Incident logs</DialogTitle>
            <DialogDescription>
              Raw command outputs captured for this incident.
            </DialogDescription>
          </DialogHeader>

          {isLoadingLogs && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading logs...</span>
            </div>
          )}

          {logsError && <div className="text-sm text-red-500">{logsError}</div>}

          {logs && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4">
                {highlightTokens.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Highlighted lines are based on Gemini summary signals.
                  </p>
                )}
                {logs.commands.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No command outputs available.
                  </p>
                ) : (
                  logs.commands.map((command, idx) => (
                    <div
                      key={`${command.label}-${idx}`}
                      className="rounded-lg border bg-slate-950 text-slate-100"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                          {command.label}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(command.updatedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="px-3 py-2 text-xs text-slate-400">
                        {command.command}
                      </div>
                      <pre className="px-3 pb-3 text-xs whitespace-pre-wrap">
                        {command.output.split("\n").map((line, lineIdx) => {
                          const lineLower = line.toLowerCase();
                          const isHighlighted = highlightTokens.some((token) =>
                            lineLower.includes(token),
                          );
                          return (
                            <span
                              key={`${command.label}-${lineIdx}`}
                              className={
                                isHighlighted
                                  ? "block rounded bg-amber-500/20 text-amber-100"
                                  : "block"
                              }
                            >
                              {line || " "}
                            </span>
                          );
                        })}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}

export default function IncidentsPage() {
  const { incidents, stats, isLoading, error, refetch, clearHistory } =
    useIncidents();
  const [isClearing, setIsClearing] = useState(false);

  const handleClearHistory = async () => {
    setIsClearing(true);
    await clearHistory();
    setIsClearing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const autoHealRate =
    stats && stats.total > 0
      ? Math.round((stats.last24h.autoHealed / stats.total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
          <p className="text-sm text-muted-foreground">
            Real-time incident detection with auto-healing and escalation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            disabled={isClearing || incidents.length === 0}
          >
            {isClearing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-4 w-4" />
            )}
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="py-3">
            <p className="text-sm text-yellow-600">
              {error} - Showing cached data if available
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Recent Incidents</h2>
        </div>

        {incidents.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">No incidents detected</p>
              <p className="text-sm text-muted-foreground">
                Your cluster is running smoothly. Use the Simulator to test
                incident detection.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
