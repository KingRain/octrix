"use client";

import { TrianglePod, type PodHealth } from "./triangle-pod";
import type { ServiceGroup, PodInfo } from "@/types/overview";
import { useMemo, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ServiceTriangleProps {
  service: ServiceGroup;
  isConnected?: boolean;
}

function mapPodStatus(status: PodInfo["status"]): PodHealth {
  if (status === "healthy") return "healthy";
  if (status === "healing") return "healing";
  if (status === "failed") return "failed";
  if (status === "pending") return "pending";
  return "unknown";
}

function getPodHealthPriority(health: PodHealth): number {
  switch (health) {
    case "failed":
      return 0;
    case "healing":
      return 1;
    case "pending":
      return 2;
    case "unknown":
      return 3;
    case "healthy":
      return 4;
    default:
      return 5;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(0)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

export function ServiceTriangle({
  service,
  isConnected = false,
}: ServiceTriangleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const hasPods = isConnected && service.pods.length > 0;

  const healthyCnt = service.healthyCount;
  const healingCnt = service.healingCount;
  const failedCnt = service.failedCount;

  const displayPods = useMemo(() => {
    const sortedPods = [...service.pods].sort((a, b) => {
      const healthA = mapPodStatus(a.status);
      const healthB = mapPodStatus(b.status);
      const priorityA = getPodHealthPriority(healthA);
      const priorityB = getPodHealthPriority(healthB);
      return priorityA - priorityB;
    });
    return sortedPods;
  }, [service.pods]);

  const trianglePositions = useMemo(() => {
    const positions: {
      x: number;
      y: number;
      inverted: boolean;
      size: number;
    }[] = [];
    const containerWidth = 140;
    const containerHeight = 80;

    // Dynamic sizing based on pod count to prevent overflow
    const podCount = displayPods.length;
    let podSize = 22;
    let horizontalSpacing = 8;
    let verticalGap = 10;

    if (podCount > 10) {
      podSize = 18;
      horizontalSpacing = 6;
      verticalGap = 8;
    }
    if (podCount > 20) {
      podSize = 14;
      horizontalSpacing = 4;
      verticalGap = 6;
    }

    const triangleHeight = podSize * 0.866;
    const halfWidth = podSize / 2;

    const trianglesPerRow = Math.floor(
      (containerWidth - 10) / (halfWidth + horizontalSpacing / 2),
    );
    const maxRows = Math.floor(
      (containerHeight - 10) / (triangleHeight + verticalGap),
    );

    let podIndex = 0;

    for (let row = 0; row < maxRows && podIndex < displayPods.length; row++) {
      for (
        let col = 0;
        col < trianglesPerRow && podIndex < displayPods.length;
        col++
      ) {
        const isInverted = col % 2 === 1;
        const x = col * (halfWidth + horizontalSpacing / 2);
        const y = row * (triangleHeight + verticalGap);

        positions.push({ x, y, inverted: isInverted, size: podSize });
        podIndex++;
      }
    }

    return positions;
  }, [displayPods.length]);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="relative flex flex-col items-center cursor-pointer group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="text-center mb-1">
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                {service.name.replace(/-/g, " ")}
              </span>
            </div>
            <div className="relative" style={{ width: 160, height: 94 }}>
              <svg
                width={160}
                height={94}
                viewBox="0 0 160 94"
                className="absolute inset-0"
              >
                <path
                  d="M 12 2 L 155 2 L 143 92 L 0 92 Z"
                  className="transition-all duration-300"
                  style={{
                    fill: isHovered
                      ? "rgba(59, 130, 246, 0.08)"
                      : "rgba(30, 30, 30, 0.5)",
                    stroke: isHovered ? "#3b82f6" : "#374151",
                    strokeWidth: isHovered ? 1.5 : 1,
                  }}
                />
              </svg>

              <div
                className="absolute left-3 overflow-hidden"
                style={{ top: 10, width: 140, height: 80 }}
              >
                {hasPods && (
                  <div className="relative">
                    {displayPods.map((pod, idx) => {
                      const pos = trianglePositions[idx] as any;
                      if (!pos) return null;

                      return (
                        <div
                          key={pod.id}
                          className="absolute transition-all duration-200"
                          style={{
                            left: pos.x,
                            top: pos.y,
                            transform: pos.inverted
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                          }}
                        >
                          <TrianglePod
                            name={pod.name}
                            health={mapPodStatus(pod.status)}
                            cpu={pod.cpu}
                            memory={pod.memory}
                            restarts={pod.restarts}
                            pvcHealth={pod.pvcHealth}
                            pvcs={pod.pvcs}
                            timeToOomSeconds={pod.timeToOomSeconds}
                            memoryGrowthRateBytesPerSecond={
                              pod.memoryGrowthRateBytesPerSecond
                            }
                            size={pos.size}
                            showTooltip={true}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={12}
          className="bg-[#1a1a1a] border border-gray-600 rounded-xl shadow-2xl p-0 overflow-hidden min-w-[200px]"
        >
          <div className="px-4 py-3 border-b border-gray-700 bg-linear-to-r from-[#222] to-[#1a1a1a]">
            <p className="text-sm font-semibold text-white">
              {service.name.replace(/-/g, " ")}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{service.namespace}</p>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
                <div>
                  <span className="text-xs text-gray-400 block">Healthy</span>
                  <span className="text-sm text-green-400 font-semibold">
                    {healthyCnt}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-sm shadow-yellow-500/50" />
                <div>
                  <span className="text-xs text-gray-400 block">Healing</span>
                  <span className="text-sm text-yellow-400 font-semibold">
                    {healingCnt}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
                <div>
                  <span className="text-xs text-gray-400 block">Failed</span>
                  <span className="text-sm text-red-400 font-semibold">
                    {failedCnt}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                <div>
                  <span className="text-xs text-gray-400 block">Total</span>
                  <span className="text-sm text-blue-400 font-semibold">
                    {service.pods.length}
                  </span>
                </div>
              </div>
            </div>
            <div className="h-px bg-gray-700" />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">CPU Usage</span>
                <span className="text-xs text-cyan-400 font-mono font-medium">
                  {(service.totalCpu / 1000).toFixed(2)} cores
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Memory Usage</span>
                <span className="text-xs text-purple-400 font-mono font-medium">
                  {formatBytes(service.totalMemory)}
                </span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
