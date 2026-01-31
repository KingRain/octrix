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
  WifiOff, // Network Blackhole
  FileDiff, // Config Drift
  ShieldAlert, // Readiness Lies
  Zap, // Silent Failure Section Header
  Clock, // Pod Running App Broken (High Latency)
  MemoryStick,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSimulator, type SimulationScenario } from "@/hooks/use-simulator";
import { useOverview } from "@/hooks/use-overview";
import type { ServiceGroup } from "@/types/overview";
import { cn } from "@/lib/utils";

const scenarioIcons: Record<string, typeof HardDrive> = {
  "oom-killed": HardDrive,
  "high-cpu": Cpu,
  "crash-loop": RefreshCw,
  "pod-throttling": Gauge,
  underutilization: TrendingDown,
  "node-eviction": Server,
  "image-pull-delay": ImageOff,
  "buggy-deployment": Bug,
  "configmap-error": Settings,
  "db-failure": Database,
  "unknown-crash": HelpCircle,
  "multi-service-failure": Layers,
  // Silent Failures
  "pod-running-app-broken": Clock,
  "readiness-lies": ShieldAlert,
  "config-drift": FileDiff,
  "network-blackhole": WifiOff,
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
    <Card
      className="relative overflow-hidden cursor-pointer hover:shadow-lg hover:bg-accent/50 transition-all border-2"
      onClick={() => onRun(scenario.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg truncate">
                {scenario.name}
              </CardTitle>
            </div>
            <CardDescription className="text-xs mt-1">
              {scenario.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={severityColors[scenario.severity] || "bg-gray-500/10"}
          >
            <span className="text-[10px]">{scenario.severity.toUpperCase()}</span>
          </Badge>
          <Badge
            variant="outline"
            className={
              scenario.autoHealable
                ? "bg-green-500/10 text-green-500"
                : "bg-red-500/10 text-red-500"
            }
          >
            <span className="text-[10px]">{scenario.autoHealable ? "Auto-Heal" : "Escalate"}</span>
          </Badge>
        </div>

        {isRunning ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Running...</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CustomPodSpawner({
  onRun,
  isRunning,
  services,
}: {
  onRun: (id: string, params: any) => void;
  isRunning: boolean;
  services: ServiceGroup[];
}) {
  const [memoryLimit, setMemoryLimit] = useState(128);
  const [simulateActivity, setSimulateActivity] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<string>("");
  const [isPending, setIsPending] = useState(false);

  const handleSpawn = async () => {
    if (!selectedCluster) {
      return;
    }
    setIsPending(true);
    try {
      await onRun("custom-oom", {
        memoryLimitMi: memoryLimit,
        simulateActivity,
        targetResource: selectedCluster,
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card className="border-border bg-card mb-8">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MemoryStick className="h-5 w-5 text-green-500" />
          <CardTitle className="text-base text-foreground">
            Custom Pod Spawner
          </CardTitle>
        </div>
        <CardDescription>
          Spawn a custom pod with configurable memory and activity simulation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Target Cluster/Service</Label>
            <Select value={selectedCluster || ""} onValueChange={setSelectedCluster}>
              <SelectTrigger className="bg-background/50 border-border hover:border-green-500/50 transition-colors">
                <SelectValue placeholder="Select cluster" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s, index) => (
                  <SelectItem key={`${s.name}-${s.namespace}-${index}`} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Memory Limit: {memoryLimit} Mi</Label>
            <input
              type="range"
              min="64"
              max="512"
              step="64"
              value={memoryLimit}
              onChange={(e) => setMemoryLimit(parseInt(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-green-500"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>64 Mi</span>
              <span>512 Mi</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Simulate Activity</Label>
            <div className="flex items-center gap-2 p-2 rounded-md border border-border bg-background/50 h-10 hover:border-green-500/50 transition-colors">
              <Switch
                checked={simulateActivity}
                onCheckedChange={setSimulateActivity}
              />
              <span className="text-sm text-muted-foreground">
                {simulateActivity ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full border-green-500 text-green-500 hover:bg-green-500/10 hover:text-green-400"
          onClick={handleSpawn}
          disabled={isPending || isRunning || !selectedCluster}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Spawn Pod
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
  const { overview } = useOverview();
  const [runningScenarios, setRunningScenarios] = useState<Set<string>>(
    new Set(),
  );

  const handleRunScenario = async (scenarioId: string, params?: any) => {
    // If scenarioId is "custom-oom", we might need to find the real ID from the list
    let realId = scenarioId;
    if (scenarioId === "custom-oom") {
      const customScenario = scenarios.find((s) => s.type === "custom-oom");
      if (customScenario) realId = customScenario.id;
      else {
        // Fallback: Use any scenario ID if backend supports loose types, but better to fail or warn
        console.error("Custom OOM scenario not found in backend list");
        return;
      }
    }

    setRunningScenarios((prev) => new Set(prev).add(realId));
    try {
      await startSimulation(
        realId,
        "default",
        params?.targetResource || "custom-oom-pod",
        60,
        params,
      );
    } finally {
      setRunningScenarios((prev) => {
        const next = new Set(prev);
        next.delete(realId);
        return next;
      });
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-transparent min-h-screen p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Simulator & Fault Injection
          </h1>
          <p className="text-sm text-muted-foreground">
            Controlled failure injection for testing incident detection and
            auto-healing
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

      <CustomPodSpawner
        onRun={handleRunScenario}
        isRunning={false}
        services={overview?.services || []}
      />

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
        <div className="space-y-8">
          {/* Standard Chaos Engineering Scenarios */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium tracking-tight">
                Production Scenarios
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {scenarios
                .filter(
                  (s) =>
                    ![
                      "pod-running-app-broken",
                      "readiness-lies",
                      "config-drift",
                      "network-blackhole",
                    ].includes(s.type),
                )
                .map((scenario) => (
                  <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    onRun={handleRunScenario}
                    isRunning={runningScenarios.has(scenario.id)}
                  />
                ))}
            </div>
          </div>

          {/* New Silent Failure Scenarios */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium tracking-tight flex items-center gap-2">
                  Silent Failure Simulations
                </h2>
                <p className="text-sm text-muted-foreground">
                  Simulate stealthy issues that pass standard health checks but
                  degrade user experience.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {scenarios
                .filter((s) =>
                  [
                    "pod-running-app-broken",
                    "readiness-lies",
                    "config-drift",
                    "network-blackhole",
                  ].includes(s.type),
                )
                .map((scenario) => (
                  <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    onRun={handleRunScenario}
                    isRunning={runningScenarios.has(scenario.id)}
                  />
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
