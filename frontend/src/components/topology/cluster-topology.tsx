"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import { PodNode } from "./pod-node";
import { ServiceNode } from "./service-node";
import { DeploymentNode } from "./deployment-node";
import type { Pod, Service, Deployment } from "@/types";

interface ClusterTopologyProps {
  pods: Pod[];
  services: Service[];
  deployments: Deployment[];
}

const nodeTypes = {
  pod: PodNode,
  service: ServiceNode,
  deployment: DeploymentNode,
};

function generateTopologyData(
  pods: Pod[],
  services: Service[],
  deployments: Deployment[]
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const deploymentMap = new Map<string, { x: number; y: number }>();
  deployments.forEach((deployment, index) => {
    const x = 100;
    const y = index * 200 + 50;
    deploymentMap.set(deployment.name, { x, y });

    nodes.push({
      id: `deployment-${deployment.id}`,
      type: "deployment",
      position: { x, y },
      data: {
        label: deployment.name,
        namespace: deployment.namespace,
        replicas: deployment.replicas,
        availableReplicas: deployment.availableReplicas,
        status:
          deployment.availableReplicas === deployment.replicas
            ? "healthy"
            : "warning",
      },
    });
  });

  const serviceMap = new Map<string, { x: number; y: number }>();
  services.forEach((service, index) => {
    const x = 400;
    const y = index * 150 + 50;
    serviceMap.set(service.name, { x, y });

    nodes.push({
      id: `service-${service.id}`,
      type: "service",
      position: { x, y },
      data: {
        label: service.name,
        namespace: service.namespace,
        type: service.type,
        clusterIP: service.clusterIP,
        ports: service.ports,
      },
    });
  });

  pods.forEach((pod, index) => {
    const x = 700;
    const y = index * 120 + 50;

    nodes.push({
      id: `pod-${pod.id}`,
      type: "pod",
      position: { x, y },
      data: {
        label: pod.name,
        namespace: pod.namespace,
        status: pod.status,
        nodeName: pod.nodeName,
        restarts: pod.restarts,
        cpuUsage: pod.cpuUsage,
        memoryUsage: pod.memoryUsage,
      },
    });

    const appLabel = pod.labels?.app;
    if (appLabel) {
      const matchingService = services.find(
        (s) => s.selector?.app === appLabel
      );
      if (matchingService) {
        edges.push({
          id: `edge-service-${matchingService.id}-pod-${pod.id}`,
          source: `service-${matchingService.id}`,
          target: `pod-${pod.id}`,
          type: "smoothstep",
          animated: pod.status === "running",
          style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "hsl(var(--muted-foreground))",
          },
        });
      }

      const matchingDeployment = deployments.find(
        (d) => d.selector?.app === appLabel
      );
      if (matchingDeployment) {
        edges.push({
          id: `edge-deployment-${matchingDeployment.id}-pod-${pod.id}`,
          source: `deployment-${matchingDeployment.id}`,
          target: `pod-${pod.id}`,
          type: "smoothstep",
          style: {
            stroke: "hsl(var(--muted-foreground))",
            strokeWidth: 1,
            strokeDasharray: "5,5",
          },
        });
      }
    }
  });

  return { nodes, edges };
}

export function ClusterTopology({
  pods,
  services,
  deployments,
}: ClusterTopologyProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => generateTopologyData(pods, services, deployments),
    [pods, services, deployments]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onInit = useCallback(() => {
    // Fit view on init
  }, []);

  return (
    <div className="h-[600px] w-full rounded-lg border border-border bg-card">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        className="bg-background"
      >
        <Controls className="bg-card border-border" />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--muted-foreground) / 0.2)"
        />
      </ReactFlow>
    </div>
  );
}
