"use client";

import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  status?: "healthy" | "warning" | "critical";
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  status,
}: StatsCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-semibold tracking-tight">{value}</p>
              {trend && (
                <span
                  className={cn(
                    "text-sm font-medium",
                    trend.isPositive ? "text-green-500" : "text-red-500"
                  )}
                >
                  {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              status === "healthy" && "bg-green-500/10 text-green-500",
              status === "warning" && "bg-yellow-500/10 text-yellow-500",
              status === "critical" && "bg-red-500/10 text-red-500",
              !status && "bg-primary/10 text-primary"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
      {status && (
        <div
          className={cn(
            "absolute bottom-0 left-0 h-1 w-full",
            status === "healthy" && "bg-green-500",
            status === "warning" && "bg-yellow-500",
            status === "critical" && "bg-red-500"
          )}
        />
      )}
    </Card>
  );
}
