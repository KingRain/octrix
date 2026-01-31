import { create } from "zustand";
import type { SimulationScenario, SimulationRun } from "@/types";

interface SimulationState {
  scenarios: SimulationScenario[];
  runs: SimulationRun[];
  activeRun: SimulationRun | null;
  isLoading: boolean;
  error: string | null;

  setScenarios: (scenarios: SimulationScenario[]) => void;
  addScenario: (scenario: SimulationScenario) => void;
  updateScenario: (scenarioId: string, updates: Partial<SimulationScenario>) => void;
  deleteScenario: (scenarioId: string) => void;
  setRuns: (runs: SimulationRun[]) => void;
  addRun: (run: SimulationRun) => void;
  updateRun: (runId: string, updates: Partial<SimulationRun>) => void;
  setActiveRun: (run: SimulationRun | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  scenarios: [],
  runs: [],
  activeRun: null,
  isLoading: false,
  error: null,

  setScenarios: (scenarios) => set({ scenarios }),
  addScenario: (scenario) =>
    set((state) => ({ scenarios: [...state.scenarios, scenario] })),
  updateScenario: (scenarioId, updates) =>
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === scenarioId ? { ...scenario, ...updates } : scenario
      ),
    })),
  deleteScenario: (scenarioId) =>
    set((state) => ({
      scenarios: state.scenarios.filter((scenario) => scenario.id !== scenarioId),
    })),
  setRuns: (runs) => set({ runs }),
  addRun: (run) => set((state) => ({ runs: [run, ...state.runs] })),
  updateRun: (runId, updates) =>
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId ? { ...run, ...updates } : run
      ),
      activeRun:
        state.activeRun?.id === runId
          ? { ...state.activeRun, ...updates }
          : state.activeRun,
    })),
  setActiveRun: (activeRun) => set({ activeRun }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
