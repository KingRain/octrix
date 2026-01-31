"use client";

import { Shield, CheckCircle, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { HealingEvent } from "@/types";
import { cn } from "@/lib/utils";

interface HealingActivityProps {
  events: HealingEvent[];
}

function getStatusIcon(status: HealingEvent["status"]) {
  switch (status) {
    case "success":
      return CheckCircle;
    case "failed":
      return XCircle;
    case "in-progress":
      return Clock;
  }
}

function getStatusColor(status: HealingEvent["status"]) {
  switch (status) {
    case "success":
      return "text-green-500";
    case "failed":
      return "text-red-500";
    case "in-progress":
      return "text-yellow-500";
  }
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HealingActivity({ events }: HealingActivityProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Auto-Healing Activity</CardTitle>
        <Shield className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="space-y-1 p-4 pt-0">
            {events.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                No healing events
              </div>
            ) : (
              events.map((event) => {
                const Icon = getStatusIcon(event.status);
                const statusColor = getStatusColor(event.status);

                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn("mt-0.5", statusColor)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium leading-none">
                          {event.ruleName}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(event.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {event.details}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <Badge variant="secondary" className="text-xs">
                          {event.targetNamespace || "cluster"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {event.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {event.duration}ms
                        </span>
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
