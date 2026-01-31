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
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {Array.from(visibleAlerts).map((podName) => {
        const alert = alerts.find(a => a.podName === podName);
        if (!alert || alert.timeToOomSeconds === undefined) return null;

        const urgencyLevel = alert.timeToOomSeconds < 60 ? "critical" : alert.timeToOomSeconds < 180 ? "warning" : "info";
        const bgColor = urgencyLevel === "critical" 
          ? "bg-red-50 border-red-200" 
          : urgencyLevel === "warning" 
            ? "bg-amber-50 border-amber-200" 
            : "bg-blue-50 border-blue-200";
        const headerColor = urgencyLevel === "critical" 
          ? "text-red-600" 
          : urgencyLevel === "warning" 
            ? "text-amber-600" 
            : "text-blue-600";
        const iconBg = urgencyLevel === "critical" 
          ? "bg-red-100" 
          : urgencyLevel === "warning" 
            ? "bg-amber-100" 
            : "bg-blue-100";

        return (
          <div
            key={podName}
            className={`${bgColor} border-2 rounded-xl shadow-xl overflow-hidden transition-all duration-200 hover:shadow-2xl`}
          >
            {/* Header */}
            <div className="px-4 py-3 bg-white/50 border-b border-black/5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${iconBg}`}>
                  <AlertTriangle className={`h-5 w-5 ${headerColor}`} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">OOM Warning</h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    {urgencyLevel === "critical" 
                      ? "Critical" 
                      : urgencyLevel === "warning" 
                        ? "Warning" 
                        : "Notice"}
                  </p>
                </div>
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
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md p-1 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pod</p>
                  <p className="text-sm font-mono font-medium text-gray-900 truncate" title={alert.podName}>
                    {alert.podName}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Namespace</p>
                  <p className="text-sm font-medium text-gray-900">{alert.namespace}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Memory Usage</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          urgencyLevel === "critical" 
                            ? "bg-red-500" 
                            : urgencyLevel === "warning" 
                              ? "bg-amber-500" 
                              : "bg-blue-500"
                        }`}
                        style={{ width: `${(alert.memoryUsageBytes / alert.memoryLimitBytes) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-900">
                      {Math.round((alert.memoryUsageBytes / alert.memoryLimitBytes) * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {formatBytes(alert.memoryUsageBytes)} / {formatBytes(alert.memoryLimitBytes)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Time to OOM</p>
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${iconBg}`}>
                      <Clock className={`h-4 w-4 ${headerColor}`} />
                    </div>
                    <span className={`text-lg font-bold ${headerColor}`}>
                      {formatTimeToOom(alert.timeToOomSeconds)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-4 py-3 bg-white/50 border-t border-black/5">
              <p className="text-xs font-medium text-gray-700">
                {urgencyLevel === "critical" 
                  ? "🚨 Pod will run out of memory very soon. Immediate action required."
                  : urgencyLevel === "warning"
                  ? "⚠️ Pod memory usage is growing rapidly. Monitor closely."
                  : "ℹ️ Pod memory usage is increasing. Keep monitoring."
                }
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
