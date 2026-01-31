"use client";

import { useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Check,
  MoreHorizontal,
  Bell,
} from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockAlerts } from "@/lib/mock-data";
import { useClusterStore } from "@/stores/cluster-store";
import type { Alert, AlertSeverity } from "@/types";
import { cn } from "@/lib/utils";

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
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AlertsPage() {
  const { alerts, setAlerts, acknowledgeAlert } = useClusterStore();

  useEffect(() => {
    setAlerts(mockAlerts);
  }, [setAlerts]);

  const columns: ColumnDef<Alert>[] = [
    {
      accessorKey: "severity",
      header: "Severity",
      cell: ({ row }) => {
        const Icon = getSeverityIcon(row.original.severity);
        const colorClass = getSeverityColor(row.original.severity);
        return (
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              colorClass
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        );
      },
    },
    {
      accessorKey: "title",
      header: "Alert",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.title}</span>
          <span className="text-xs text-muted-foreground line-clamp-1">
            {row.original.message}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "resource",
      header: "Resource",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-mono text-sm">{row.original.resource}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.namespace || "cluster"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "timestamp",
      header: "Time",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatTimestamp(row.original.timestamp)}
        </span>
      ),
    },
    {
      accessorKey: "acknowledged",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.acknowledged ? "secondary" : "destructive"}>
          {row.original.acknowledged ? "Acknowledged" : "Active"}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {!row.original.acknowledged && (
              <DropdownMenuItem onClick={() => acknowledgeAlert(row.original.id)}>
                <Check className="mr-2 h-4 w-4" />
                Acknowledge
              </DropdownMenuItem>
            )}
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>View Resource</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const criticalAlerts = alerts.filter(
    (a) => a.severity === "critical" && !a.acknowledged
  ).length;
  const warningAlerts = alerts.filter(
    (a) => a.severity === "warning" && !a.acknowledged
  ).length;
  const infoAlerts = alerts.filter(
    (a) => a.severity === "info" && !a.acknowledged
  ).length;
  const acknowledgedAlerts = alerts.filter((a) => a.acknowledged).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Monitor and manage cluster alerts
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{criticalAlerts}</div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Warning</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{warningAlerts}</div>
            <p className="text-xs text-muted-foreground">Should be reviewed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Info</CardTitle>
            <Info className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{infoAlerts}</div>
            <p className="text-xs text-muted-foreground">Informational notices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{acknowledgedAlerts}</div>
            <p className="text-xs text-muted-foreground">Already reviewed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">All Alerts</CardTitle>
          <Bell className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={alerts}
            searchKey="title"
            searchPlaceholder="Search alerts..."
          />
        </CardContent>
      </Card>
    </div>
  );
}
