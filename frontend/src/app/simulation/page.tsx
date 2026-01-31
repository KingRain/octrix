"use client";

import { useState } from "react";
import {
  Play,
  Loader2,
  HardDrive,
  Cpu,
  RefreshCw,
  Settings,
  Bug,
  Database,
  HelpCircle,
  Layers,
  Gauge,
  TrendingDown,
  Shield,
  Server,
  ImageOff,
  Square,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useSimulator,
  type SimulationScenario,
} from "@/hooks/use-simulator";

const scenarioIcons: Record<string, typeof HardDrive> = {
  "oom-killed": HardDrive,
  "high-cpu": Cpu,
  "crash-loop": RefreshCw,
  "pod-throttling": Gauge,
  "underutilization": TrendingDown,
  "node-eviction": Server,
  "image-pull-delay": ImageOff,
  "buggy-deployment": Bug,
  "configmap-error": Settings,
  "db-failure": Database,
  "unknown-crash": HelpCircle,
  "multi-service-failure": Layers,
};

const severityColors: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

interface ScenarioCardProps {
  scenario: SimulationScenario;
  onRun: (scenarioId: string) => void;
  isRunning: boolean;
}

function ScenarioCard({ scenario, onRun, isRunning }: ScenarioCardProps) {
  const Icon = scenarioIcons[scenario.type] || HelpCircle;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-base truncate">{scenario.name}</CardTitle>
              {scenario.autoHealable && (
                <Badge variant="outline" className="text-xs gap-1 bg-green-500/5 border-green-500/20 text-green-500 shrink-0">
                  <Shield className="h-3 w-3" />
                  Auto-Healable
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs mt-1">
              {scenario.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={severityColors[scenario.severity] || "bg-gray-500/10"}>
            {scenario.severity.toUpperCase()}
          </Badge>
          <Badge variant="outline" className={scenario.autoHealable ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}>
            {scenario.autoHealable ? "Auto-Heal" : "Escalate"}
          </Badge>
        </div>

        <Button
          variant="outline"
          className="w-full"
          size="sm"
          onClick={() => onRun(scenario.id)}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Simulation
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SimulatorPage() {
  const {
    scenarios,
    activeRuns,
    isLoading,
    error,
    refetch,
    startSimulation,
    cancelSimulation,
  } = useSimulator();

  const [runningScenarios, setRunningScenarios] = useState<Set<string>>(new Set());

  const handleRunScenario = async (scenarioId: string) => {
    setRunningScenarios((prev) => new Set(prev).add(scenarioId));
    try {
      await startSimulation(scenarioId, "default", "cdn-cache", 60);
    } finally {
      setRunningScenarios((prev) => {
        const next = new Set(prev);
        next.delete(scenarioId);
        return next;
      });
    }
  };

  const handleStopSimulation = async (runId: string) => {
    await cancelSimulation(runId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Simulator</h1>
          <p className="text-sm text-muted-foreground">
            Controlled failure injection for testing incident detection and auto-healing
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="py-3">
            <p className="text-sm text-yellow-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {activeRuns.length > 0 && (
        <div className="space-y-3">
          {activeRuns.map((run) => (
            <Card key={run.id} className="border-blue-500/50 bg-blue-500/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-medium">
                      Running: {run.scenarioName}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Namespace: {run.targetNamespace}
                    </p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleStopSimulation(run.id)}
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {run.affectedResources.map((resource, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {resource}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {scenarios.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No scenarios available</p>
            <p className="text-sm text-muted-foreground">
              Check backend connection to load simulation scenarios.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onRun={handleRunScenario}
              isRunning={runningScenarios.has(scenario.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
