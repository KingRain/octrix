"use client";

import React from "react";
import Gauge from "react-gauge-component";

interface GaugeProps {
  value: number;
  label: string;
}

export function NeedleBarGauge({ value, label }: GaugeProps) {
  const isValidValue = typeof value === 'number' && !isNaN(value) && isFinite(value);
  const displayValue = isValidValue ? Math.max(0, Math.min(100, value)) : 0;

  const color = displayValue < 50 ? '#22c55e' : displayValue < 75 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <Gauge
        value={displayValue}
      />
      <p className="text-sm font-bold" style={{ color, marginTop: '4px' }}>
        {displayValue.toFixed(1)}%
      </p>
    </div>
  );
}
