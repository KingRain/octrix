"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Lightbulb,
  TrendingDown,
  AlertTriangle,
  Info,
  DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CostOptimizationInsight } from "@/hooks/use-node-utilization";

interface CostOptimizationInsightsProps {
  insights: CostOptimizationInsight[];
}

export function CostOptimizationInsights({
  insights,
}: CostOptimizationInsightsProps) {
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(
    new Set()
  );

  const toggleInsight = (id: string) => {
    setExpandedInsights((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getInsightIcon = (type: CostOptimizationInsight["type"]) => {
    switch (type) {
      case "consolidation":
        return <TrendingDown className="h-4 w-4" />;
      case "waste":
        return <AlertTriangle className="h-4 w-4" />;
      case "savings":
        return <DollarSign className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getInsightColors = (
    severity: CostOptimizationInsight["severity"],
    type: CostOptimizationInsight["type"]
  ) => {
    if (type === "info") {
      return {
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        icon: "text-blue-500",
        badge: "bg-blue-500/20 text-blue-500 border-blue-500/30",
      };
    }

    switch (severity) {
      case "high":
        return {
          bg: "bg-red-500/10",
          border: "border-red-500/20",
          icon: "text-red-500",
          badge: "bg-red-500/20 text-red-500 border-red-500/30",
        };
      case "medium":
        return {
          bg: "bg-amber-500/10",
          border: "border-amber-500/20",
          icon: "text-amber-500",
          badge: "bg-amber-500/20 text-amber-500 border-amber-500/30",
        };
      case "low":
        return {
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/20",
          icon: "text-emerald-500",
          badge: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
        };
      default:
        return {
          bg: "bg-muted",
          border: "border-border",
          icon: "text-muted-foreground",
          badge: "bg-muted text-muted-foreground border-border",
        };
    }
  };

  const formatCurrency = (value: number): string => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value.toFixed(2)}`;
  };

  if (insights.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Cost Optimization Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight) => {
          const isExpanded = expandedInsights.has(insight.id);
          const colors = getInsightColors(insight.severity, insight.type);

          return (
            <div
              key={insight.id}
              className={cn(
                "rounded-lg border transition-all",
                colors.bg,
                colors.border
              )}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={cn("mt-0.5", colors.icon)}>
                      {getInsightIcon(insight.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm text-foreground">
                          {insight.title}
                        </h4>
                        <Badge className={cn("text-xs", colors.badge)}>
                          {insight.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {insight.description}
                      </p>

                      {insight.potentialSavings && (
                        <div className="mt-2 flex items-center gap-2">
                          <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-sm font-medium text-emerald-500">
                            Potential savings:{" "}
                            {formatCurrency(insight.potentialSavings.hourly)}/hr
                            (~{formatCurrency(insight.potentialSavings.monthly)}
                            /month)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 shrink-0"
                    onClick={() => toggleInsight(insight.id)}
                  >
                    {isExpanded ? (
                      <>
                        <span className="text-xs mr-1">Hide Evidence</span>
                        <ChevronUp className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        <span className="text-xs mr-1">Show Evidence</span>
                        <ChevronDown className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Evidence
                    </h5>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {insight.evidence.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-background/50 rounded px-3 py-2"
                        >
                          <span className="text-xs text-muted-foreground">
                            {item.metric}
                          </span>
                          <span className="text-xs font-medium text-foreground">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
