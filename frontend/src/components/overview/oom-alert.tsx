"use client";

import { X, AlertTriangle, Clock } from "lucide-react";
import { useState, useEffect } from "react";

interface OOMAlert {
  podName: string;
  namespace: string;
  timeToOomSeconds: number;
  memoryUsageBytes: number;
  memoryLimitBytes: number;
}

interface OOMAlertProps {
  alerts: OOMAlert[];
  onDismiss: (podName: string) => void;
}

function formatTimeToOom(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(0)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

export function OOMAlertPopup({ alerts, onDismiss }: OOMAlertProps) {
  const [visibleAlerts, setVisibleAlerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    alerts.forEach((alert) => {
      if (alert.timeToOomSeconds !== undefined && alert.timeToOomSeconds < 300) {
        setVisibleAlerts(prev => new Set([...prev, alert.podName]));
      }
    });
  }, [alerts]);

  if (visibleAlerts.size === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {Array.from(visibleAlerts).map((podName) => {
        const alert = alerts.find(a => a.podName === podName);
        if (!alert || alert.timeToOomSeconds === undefined) return null;

        const urgencyLevel = alert.timeToOomSeconds < 60 ? "critical" : alert.timeToOomSeconds < 180 ? "warning" : "info";
        const bgColor = urgencyLevel === "critical" ? "bg-red-900/95" : urgencyLevel === "warning" ? "bg-yellow-900/95" : "bg-blue-900/95";
        const borderColor = urgencyLevel === "critical" ? "border-red-500" : urgencyLevel === "warning" ? "border-yellow-500" : "border-blue-500";

        return (
          <div
            key={podName}
            className={`${bgColor} border ${borderColor} rounded-lg shadow-2xl p-4 min-w-[320px] animate-in slide-in-from-right-4`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <h3 className="text-sm font-semibold text-white">OOM Warning</h3>
              </div>
              <button
                onClick={() => {
                  onDismiss(podName);
                  setVisibleAlerts(prev => {
                    const next = new Set(prev);
                    next.delete(podName);
                    return next;
                  });
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">Pod:</span>
                <span className="text-sm font-mono text-white">{alert.podName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">Namespace:</span>
                <span className="text-sm text-white">{alert.namespace}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">Memory Usage:</span>
                <span className="text-sm font-mono text-white">
                  {formatBytes(alert.memoryUsageBytes)} / {formatBytes(alert.memoryLimitBytes)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">Time to OOM:</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-red-400" />
                  <span className="text-sm font-mono text-red-400 font-semibold">
                    {formatTimeToOom(alert.timeToOomSeconds)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-gray-600">
              <p className="text-xs text-gray-400">
                {urgencyLevel === "critical" 
                  ? "Pod will run out of memory very soon. Immediate action required."
                  : urgencyLevel === "warning"
                  ? "Pod memory usage is growing rapidly. Monitor closely."
                  : "Pod memory usage is increasing. Keep monitoring."
                }
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
