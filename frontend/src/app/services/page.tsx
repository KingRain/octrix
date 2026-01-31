"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Eye, ExternalLink } from "lucide-react";
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
import { mockServices } from "@/lib/mock-data";
import type { Service } from "@/types";

const columns: ColumnDef<Service>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.original.name}</span>
        <span className="text-xs text-muted-foreground">
          {row.original.namespace}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.type}</Badge>
    ),
  },
  {
    accessorKey: "clusterIP",
    header: "Cluster IP",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.clusterIP}</span>
    ),
  },
  {
    accessorKey: "externalIP",
    header: "External IP",
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {row.original.externalIP || "-"}
      </span>
    ),
  },
  {
    accessorKey: "ports",
    header: "Ports",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.ports.map((port) => (
          <Badge key={port.name} variant="secondary" className="text-xs">
            {port.port}:{port.targetPort}/{port.protocol}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    accessorKey: "endpoints",
    header: "Endpoints",
    cell: ({ row }) => {
      const ready = row.original.endpoints.filter((e) => e.ready).length;
      const total = row.original.endpoints.length;
      return (
        <Badge variant={ready === total ? "secondary" : "destructive"}>
          {ready}/{total}
        </Badge>
      );
    },
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
          <DropdownMenuItem>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          {row.original.externalIP && (
            <DropdownMenuItem>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open External
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
        <p className="text-sm text-muted-foreground">
          View and manage Kubernetes services
        </p>
      </div>

      <DataTable
        columns={columns}
        data={mockServices}
        searchKey="name"
        searchPlaceholder="Search services..."
      />
    </div>
  );
}
