"use client";

import { Server, Box, Network, Cpu, HardDrive, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { mockClusters, mockNodes, mockNamespaces } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function ClusterPage() {
  const cluster = mockClusters[0];
  const healthyNodes = mockNodes.filter((n) => n.status === "ready").length;

  return (
    <div className="space-y-6 bg-transparent min-h-screen p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cluster Overview</h1>
        <p className="text-sm text-muted-foreground">
          Detailed view of cluster resources and configuration
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cluster</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{cluster.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={cluster.status} />
              <span className="text-xs text-muted-foreground">
                v{cluster.version}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Region</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{cluster.region}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Provider: {cluster.provider.toUpperCase()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Nodes</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {healthyNodes}/{mockNodes.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {mockNodes.length - healthyNodes} not ready
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Namespaces</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{mockNamespaces.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active namespaces
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="resources" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="namespaces">Namespaces</TabsTrigger>
          <TabsTrigger value="nodes">Nodes</TabsTrigger>
        </TabsList>

        <TabsContent value="resources" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  CPU Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Cluster Average</span>
                    <span className="font-medium">{cluster.cpuUsage}%</span>
                  </div>
                  <Progress value={cluster.cpuUsage} className="h-2" />
                </div>
                {mockNodes
                  .filter((n) => n.status === "ready")
                  .map((node) => {
                    const usage = Math.round(
                      (node.cpuUsage / node.cpuCapacity) * 100
                    );
                    return (
                      <div key={node.id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {node.name.split(".")[0]}
                          </span>
                          <span>{usage}%</span>
                        </div>
                        <Progress
                          value={usage}
                          className={cn(
                            "h-1.5",
                            usage > 80 && "[&>div]:bg-yellow-500"
                          )}
                        />
                      </div>
                    );
                  })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Memory Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Cluster Average</span>
                    <span className="font-medium">{cluster.memoryUsage}%</span>
                  </div>
                  <Progress value={cluster.memoryUsage} className="h-2" />
                </div>
                {mockNodes
                  .filter((n) => n.status === "ready")
                  .map((node) => {
                    const usage = Math.round(
                      (node.memoryUsage / node.memoryCapacity) * 100
                    );
                    return (
                      <div key={node.id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {node.name.split(".")[0]}
                          </span>
                          <span>{usage}%</span>
                        </div>
                        <Progress
                          value={usage}
                          className={cn(
                            "h-1.5",
                            usage > 80 && "[&>div]:bg-yellow-500"
                          )}
                        />
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="namespaces" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mockNamespaces.map((ns) => (
              <Card key={ns.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {ns.name}
                    </CardTitle>
                    <Badge
                      variant={ns.status === "Active" ? "secondary" : "destructive"}
                    >
                      {ns.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Pods</p>
                      <p className="font-medium">{ns.podCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Services</p>
                      <p className="font-medium">{ns.serviceCount}</p>
                    </div>
                  </div>
                  {Object.keys(ns.labels).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {Object.entries(ns.labels).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="text-xs">
                          {key}: {value}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="nodes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {mockNodes.map((node) => {
              const cpuUsage = Math.round(
                (node.cpuUsage / node.cpuCapacity) * 100
              );
              const memUsage = Math.round(
                (node.memoryUsage / node.memoryCapacity) * 100
              );

              return (
                <Card key={node.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium font-mono">
                        {node.name.split(".")[0]}
                      </CardTitle>
                      <StatusBadge status={node.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">{node.ip}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {node.role === "control-plane" ? "Control Plane" : "Worker"}
                      </Badge>
                      <Badge variant="secondary">{node.podCount} pods</Badge>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">CPU</span>
                          <span>
                            {node.cpuUsage}m / {node.cpuCapacity}m ({cpuUsage}%)
                          </span>
                        </div>
                        <Progress value={cpuUsage} className="h-1.5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Memory</span>
                          <span>
                            {Math.round(node.memoryUsage / 1024)}Gi /{" "}
                            {Math.round(node.memoryCapacity / 1024)}Gi ({memUsage}%)
                          </span>
                        </div>
                        <Progress value={memUsage} className="h-1.5" />
                      </div>
                    </div>

                    {node.taints.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {node.taints.map((taint, idx) => (
                          <Badge
                            key={idx}
                            variant="destructive"
                            className="text-xs"
                          >
                            {taint.key}: {taint.effect}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
