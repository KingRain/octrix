"use client";

import { AlertCircle, AlertTriangle, Info, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Alert, AlertSeverity } from "@/types";
import { cn } from "@/lib/utils";

interface AlertsListProps {
  alerts: Alert[];
  onAcknowledge?: (alertId: string) => void;
}

function getSeverityIcon(severity: AlertSeverity) {
  switch (severity) {
    case "critical":
      return AlertCircle;
    case "warning":
      return AlertTriangle;
    case "info":
      return Info;
  }
}

function getSeverityColor(severity: AlertSeverity) {
  switch (severity) {
    case "critical":
      return "text-red-500 bg-red-500/10";
    case "warning":
      return "text-yellow-500 bg-yellow-500/10";
    case "info":
      return "text-blue-500 bg-blue-500/10";
  }
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function AlertsList({ alerts, onAcknowledge }: AlertsListProps) {
  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Recent Alerts</CardTitle>
        <Badge variant="outline" className="text-xs">
          {unacknowledgedAlerts.length} unread
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="space-y-1 p-4 pt-0">
            {alerts.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                No alerts
              </div>
            ) : (
              alerts.map((alert) => {
                const Icon = getSeverityIcon(alert.severity);
                const colorClass = getSeverityColor(alert.severity);

                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg p-3 transition-colors",
                      alert.acknowledged
                        ? "opacity-60"
                        : "bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        colorClass
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium leading-none">
                          {alert.title}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(alert.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <Badge variant="secondary" className="text-xs">
                          {alert.namespace || "cluster"}
                        </Badge>
                        {!alert.acknowledged && onAcknowledge && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => onAcknowledge(alert.id)}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
