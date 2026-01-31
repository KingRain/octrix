"use client";

import { HexagonPod, type PodHealth } from "./hexagon-pod";
import type { ServiceGroup, PodInfo } from "@/types/overview";
import { useMemo, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ServiceHexagonProps {
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
    case "failed": return 0;
    case "healing": return 1;
    case "pending": return 2;
    case "unknown": return 3;
    case "healthy": return 4;
    default: return 5;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(0)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

export function ServiceHexagon({ service, isConnected = false }: ServiceHexagonProps) {
  const maxPods = 12;
  const containerSize = 220;
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
    return sortedPods.slice(0, maxPods);
  }, [service.pods]);

  const podCount = displayPods.length;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className="relative flex flex-col items-center cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              {service.name.replace(/-/g, " ")}
            </p>
            <div className="relative" style={{ width: containerSize, height: containerSize }}>
              <svg
                width={containerSize}
                height={containerSize}
                viewBox={`0 0 ${containerSize} ${containerSize}`}
                className="absolute inset-0"
              >
                <polygon
                  points={`${containerSize/2},4 ${containerSize-4},${containerSize*0.27} ${containerSize-4},${containerSize*0.73} ${containerSize/2},${containerSize-4} 4,${containerSize*0.73} 4,${containerSize*0.27}`}
                  className="transition-all duration-200"
                  style={{
                    fill: isHovered ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
                    stroke: isHovered ? '#22c55e' : '#2a4a3a',
                    strokeWidth: isHovered ? 3 : 2,
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {hasPods && (
                  <div className="relative" style={{ width: 140, height: 120 }}>
                    {displayPods.map((pod, idx) => {
                      const positions = [
                        { x: 10, y: 0 },
                        { x: 50, y: 0 },
                        { x: 90, y: 0 },
                        { x: 30, y: 25 },
                        { x: 70, y: 25 },
                        { x: 10, y: 50 },
                        { x: 50, y: 50 },
                        { x: 90, y: 50 },
                        { x: 30, y: 75 },
                        { x: 70, y: 75 },
                        { x: 50, y: 95 },
                        { x: 10, y: 95 },
                      ];
                      const pos = positions[idx];
                      if (!pos) return null;
                      return (
                        <div
                          key={pod.id}
                          className="absolute"
                          style={{ 
                            left: pos.x, 
                            top: pos.y,
                          }}
                        >
                          <HexagonPod
                            name={pod.name}
                            health={mapPodStatus(pod.status)}
                            cpu={pod.cpu}
                            memory={pod.memory}
                            restarts={pod.restarts}
                            size={26}
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
          className="bg-[#1a1a1a] border border-gray-700 p-3 rounded-lg shadow-xl"
        >
          <div className="space-y-2">
            <p className="text-sm font-medium text-white">{service.name.replace(/-/g, " ")}</p>
            <div className="h-px bg-gray-700" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-gray-400">Healthy:</span>
                <span className="text-green-400 font-medium">{healthyCnt}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-gray-400">Healing:</span>
                <span className="text-yellow-400 font-medium">{healingCnt}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-gray-400">Failed:</span>
                <span className="text-red-400 font-medium">{failedCnt}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-gray-400">Total:</span>
                <span className="text-blue-400 font-medium">{service.pods.length}</span>
              </div>
            </div>
            <div className="h-px bg-gray-700" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">CPU:</span>
              <span className="text-cyan-400 font-medium">{(service.totalCpu / 1000).toFixed(2)} cores</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">RAM:</span>
              <span className="text-purple-400 font-medium">{formatBytes(service.totalMemory)}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
