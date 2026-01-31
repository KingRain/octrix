"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = 
  | "healthy" | "warning" | "critical" | "unknown"
  | "ready" | "not-ready"
  | "running" | "pending" | "succeeded" | "failed"
  | "success" | "in-progress";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

function getStatusConfig(status: StatusType) {
  switch (status) {
    case "healthy":
    case "ready":
    case "running":
    case "succeeded":
    case "success":
      return {
        label: status.charAt(0).toUpperCase() + status.slice(1),
        className: "bg-green-500/10 text-green-500 border-green-500/20",
      };
    case "warning":
    case "pending":
    case "in-progress":
      return {
        label: status === "in-progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1),
        className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      };
    case "critical":
    case "not-ready":
    case "failed":
      return {
        label: status === "not-ready" ? "Not Ready" : status.charAt(0).toUpperCase() + status.slice(1),
        className: "bg-red-500/10 text-red-500 border-red-500/20",
      };
    case "unknown":
    default:
      return {
        label: "Unknown",
        className: "bg-muted text-muted-foreground border-muted",
      };
  }
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = getStatusConfig(status);

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </Badge>
  );
}
