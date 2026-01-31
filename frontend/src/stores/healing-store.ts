import { create } from "zustand";
import type { HealingRule, HealingEvent } from "@/types";

interface HealingState {
  rules: HealingRule[];
  events: HealingEvent[];
  isLoading: boolean;
  error: string | null;

  setRules: (rules: HealingRule[]) => void;
  addRule: (rule: HealingRule) => void;
  updateRule: (ruleId: string, updates: Partial<HealingRule>) => void;
  deleteRule: (ruleId: string) => void;
  toggleRule: (ruleId: string) => void;
  setEvents: (events: HealingEvent[]) => void;
  addEvent: (event: HealingEvent) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useHealingStore = create<HealingState>((set) => ({
  rules: [],
  events: [],
  isLoading: false,
  error: null,

  setRules: (rules) => set({ rules }),
  addRule: (rule) => set((state) => ({ rules: [...state.rules, rule] })),
  updateRule: (ruleId, updates) =>
    set((state) => ({
      rules: state.rules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...updates } : rule
      ),
    })),
  deleteRule: (ruleId) =>
    set((state) => ({
      rules: state.rules.filter((rule) => rule.id !== ruleId),
    })),
  toggleRule: (ruleId) =>
    set((state) => ({
      rules: state.rules.map((rule) =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      ),
    })),
  setEvents: (events) => set({ events }),
  addEvent: (event) => set((state) => ({ events: [event, ...state.events] })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
