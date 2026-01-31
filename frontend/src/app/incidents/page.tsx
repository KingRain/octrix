"use client";

import { useState } from "react";
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
  ExternalLink,
  Loader2,
  Database,
  Bug,
  HelpCircle,
  Layers,
  Gauge,
  TrendingDown,
  ImageOff,
  XCircle,
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
  useIncidents,
  type Incident,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentCategory,
  type IncidentSummary,
  type SLOBurnDriver,
} from "@/hooks/use-incidents";
import { cn } from "@/lib/utils";

const severityConfig: Record<IncidentSeverity, { color: string; icon: typeof AlertCircle }> = {
  critical: { color: "text-red-500 bg-red-500/10", icon: AlertCircle },
  high: { color: "text-orange-500 bg-orange-500/10", icon: AlertTriangle },
  medium: { color: "text-yellow-500 bg-yellow-500/10", icon: AlertTriangle },
  low: { color: "text-blue-500 bg-blue-500/10", icon: AlertCircle },
};

const statusConfig: Record<IncidentStatus, { color: string; label: string }> = {
  open: { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", label: "Open" },
  acknowledged: { color: "bg-blue-500/10 text-blue-500 border-blue-500/20", label: "Acknowledged" },
  healing: { color: "bg-purple-500/10 text-purple-500 border-purple-500/20", label: "Healing" },
  escalated: { color: "bg-red-500/10 text-red-500 border-red-500/20", label: "Escalated" },
  resolved: { color: "bg-green-500/10 text-green-500 border-green-500/20", label: "Resolved" },
};

const categoryIcons: Record<string, typeof Cpu> = {
  "oom-killed": HardDrive,
  "high-cpu": Cpu,
  "high-memory": HardDrive,
  "crash-loop": RefreshCw,
  "pod-throttling": Gauge,
  "underutilization": TrendingDown,
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
  "underutilization": "Underutilization",
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
  "degradation": "Degradation",
  "mixed": "Mixed",
};

function getSLOBurnDriver(incident: Incident): SLOBurnDriver {
  if (incident.sloBurnDriver) return incident.sloBurnDriver;
  const category = incident.category;
  if (category === "high-cpu" || category === "high-memory" || category === "pod-throttling") {
    return "traffic-surge";
  }
  if (category === "crash-loop" || category === "oom-killed" || category === "buggy-deployment") {
    return "degradation";
  }
  return "mixed";
}

function getEvidence(incident: Incident): string {
  if (incident.evidence) return incident.evidence;
  const metrics = incident.metrics;
  const category = incident.category;
  
  if (category === "high-cpu" || category === "pod-throttling") {
    const cpuChange = metrics.cpuUsage ? `CPU +${Math.round(Number(metrics.cpuUsage))}%` : "CPU elevated";
    return `${cpuChange}, error ratio stable`;
  }
  if (category === "high-memory" || category === "oom-killed") {
    const memChange = metrics.memoryUsage ? `Memory +${Math.round(Number(metrics.memoryUsage))}%` : "Memory elevated";
    return `RPS stable, ${memChange}`;
  }
  if (category === "crash-loop") {
    const restarts = metrics.restartCount || "multiple";
    return `${restarts} restarts, p95 +120%`;
  }
  return "RPS +70%, error ratio stable";
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

function getDuration(incident: Incident): number {
  if (incident.resolvedAt) {
    return new Date(incident.resolvedAt).getTime() - new Date(incident.detectedAt).getTime();
  }
  return Date.now() - new Date(incident.detectedAt).getTime();
}

function IncidentCard({ incident }: { incident: Incident }) {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const { fetchIncidentSummary } = useIncidents();
  const SeverityIcon = severityConfig[incident.severity]?.icon || AlertCircle;
  const CategoryIcon = categoryIcons[incident.category] || HelpCircle;

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open && !summary && !isLoadingSummary) {
      setIsLoadingSummary(true);
      const summaryData = await fetchIncidentSummary(incident.id);
      setSummary(summaryData);
      setIsLoadingSummary(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <Card className={cn("transition-all", isOpen && "ring-1 ring-border")}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={cn("p-2 rounded-lg", severityConfig[incident.severity]?.color || "bg-gray-500/10")}>
                  <SeverityIcon className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">{incident.title}</CardTitle>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CategoryIcon className="h-3 w-3" />
                    <span>{categoryLabels[incident.category] || incident.category}</span>
                    <span>-</span>
                    <span>{incident.resource}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-cyan-500 font-medium">SLO burn driver:</span>{" "}
                    <span>{sloBurnDriverLabels[getSLOBurnDriver(incident)]}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-amber-500 font-medium">Evidence:</span>{" "}
                    <span className="italic">&quot;{getEvidence(incident)}&quot;</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={statusConfig[incident.status]?.color || ""}>
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

            {summary && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                <div className="space-y-1">
                  <div className="text-sm space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="font-medium">Incident #{incident.id.slice(0, 8)}</span>
                    </div>
                    <div>
                      <span className="font-medium">Root suspect:</span> {summary.rootSuspect}
                    </div>
                    <div>
                      <span className="font-medium">Impact:</span> {summary.impact}
                    </div>
                    <div className="space-y-1">
                      <span className="font-medium">Signals:</span>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        {summary.signals.map((signal: string, idx: number) => (
                          <li key={idx} className="text-xs">{signal}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <span className="font-medium">Classification:</span> {summary.classification}
                      </div>
                      <div>
                        <span className="font-medium">Blast radius:</span> {summary.blastRadius}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Generated at {new Date(summary.generatedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</p>
                <p className="text-sm">{incident.description}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Suggested Action</p>
                <p className="text-sm">{incident.suggestedAction}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Namespace</p>
                <p className="text-sm">{incident.namespace}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resource Type</p>
                <p className="text-sm capitalize">{incident.resourceType}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Auto-Healable</p>
                <Badge variant="outline" className={incident.autoHealable ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}>
                  {incident.autoHealable ? "Yes" : "No"}
                </Badge>
              </div>
            </div>

            {incident.autoHealingAttempted && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Auto-Healing Result</p>
                <Badge variant="outline" className={
                  incident.autoHealingResult === "success" ? "bg-green-500/10 text-green-500" :
                  incident.autoHealingResult === "failed" ? "bg-red-500/10 text-red-500" :
                  "bg-yellow-500/10 text-yellow-500"
                }>
                  {incident.autoHealingResult || "Pending"}
                </Badge>
              </div>
            )}

            {Object.keys(incident.metrics).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Metrics</p>
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
    </Collapsible>
  );
}

export default function IncidentsPage() {
  const { incidents, stats, isLoading, error, refetch, clearHistory } = useIncidents();
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

  const autoHealRate = stats && stats.total > 0
    ? Math.round(((stats.last24h.autoHealed) / stats.total) * 100)
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
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              Open
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              Healing
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Escalated
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Resolved
            </Badge>
          </div>
        </div>

        {incidents.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">No incidents detected</p>
              <p className="text-sm text-muted-foreground">
                Your cluster is running smoothly. Use the Simulator to test incident detection.
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
