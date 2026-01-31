"use client";

import { useMemo } from "react";

interface UsageGaugeProps {
  label: string;
  value: number;
  max: number;
  unit?: string;
  showPercentage?: boolean;
}

function getGaugeColor(percentage: number): string {
  if (percentage < 50) return "#22c55e";
  if (percentage < 75) return "#f59e0b";
  return "#ef4444";
}

export function UsageGauge({ 
  label, 
  value, 
  max, 
  showPercentage = true 
}: UsageGaugeProps) {
  const percentage = useMemo(() => {
    return max > 0 ? Math.min((value / max) * 100, 100) : 0;
  }, [value, max]);
  
  const color = getGaugeColor(percentage);
  
  const radius = 70;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const gradientId = useMemo(() => `gauge-gradient-${label.replace(/\s+/g, "-")}`, [label]);

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="relative" style={{ width: radius * 2, height: radius }}>
        <svg
          height={radius * 2}
          width={radius * 2}
          viewBox={`0 0 ${radius * 2} ${radius * 2}`}
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <g transform={`rotate(180 ${radius} ${radius})`}>
            <circle
              stroke="#374151"
              fill="transparent"
              strokeWidth={strokeWidth}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              strokeDasharray={`${circumference} ${circumference * 2}`}
              strokeLinecap="round"
            />
            <circle
              stroke={`url(#${gradientId})`}
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              strokeDasharray={`${circumference} ${circumference * 2}`}
              strokeDashoffset={strokeDashoffset}
              style={{ 
                transition: "stroke-dashoffset 0.8s ease-out"
              }}
            />
          </g>
        </svg>
        <div 
          className="absolute flex items-center justify-center"
          style={{ 
            left: 0, 
            right: 0, 
            bottom: 0,
            height: radius * 0.7
          }}
        >
          <span 
            className="text-2xl font-bold transition-colors duration-300"
            style={{ color }}
          >
            {showPercentage ? `${percentage.toFixed(2)}%` : value.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
