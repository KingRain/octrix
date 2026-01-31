"use client";

import { ClusterTopology } from "@/components/topology";
import { mockPods, mockServices, mockDeployments } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TopologyPage() {
  return (
    <div className="space-y-6 bg-transparent min-h-screen p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Topology</h1>
        <p className="text-sm text-muted-foreground">
          Visual representation of service relationships and pod distribution
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Deployments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockDeployments.length}</div>
            <p className="text-xs text-muted-foreground">Active deployments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockServices.length}</div>
            <p className="text-xs text-muted-foreground">Network services</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockPods.length}</div>
            <p className="text-xs text-muted-foreground">Running pods</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockServices.length + mockDeployments.length}
            </div>
            <p className="text-xs text-muted-foreground">Active connections</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Cluster Topology</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              Deployment
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Service
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Pod
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ClusterTopology
            pods={mockPods}
            services={mockServices}
            deployments={mockDeployments}
          />
        </CardContent>
      </Card>
    </div>
  );
}
