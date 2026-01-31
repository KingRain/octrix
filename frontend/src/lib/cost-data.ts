export interface CostEvent {
  id: string;
  timestamp: string;
  type: "scale-up" | "scale-down" | "resource-patch" | "optimization";
  resource: string;
  namespace: string;
  beforeCost: number;
  afterCost: number;
  savings: number;
  description: string;
}

export interface CostTrend {
  date: string;
  actual: number;
  projected: number;
  optimized: number;
}

export interface ResourceEfficiency {
  resource: string;
  namespace: string;
  cpuRequested: number;
  cpuUsed: number;
  memoryRequested: number;
  memoryUsed: number;
  costPerHour: number;
  efficiency: number;
}

export const mockCostEvents: CostEvent[] = [
  {
    id: "cost-001",
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    type: "scale-down",
    resource: "notification-service",
    namespace: "production",
    beforeCost: 12.50,
    afterCost: 6.25,
    savings: 6.25,
    description: "Scaled from 8 to 4 replicas during low traffic period",
  },
  {
    id: "cost-002",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    type: "scale-up",
    resource: "api-gateway",
    namespace: "production",
    beforeCost: 18.75,
    afterCost: 37.50,
    savings: -18.75,
    description: "Scaled from 3 to 6 replicas to handle traffic spike",
  },
  {
    id: "cost-003",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    type: "resource-patch",
    resource: "order-processor",
    namespace: "production",
    beforeCost: 8.00,
    afterCost: 10.00,
    savings: -2.00,
    description: "Increased memory limits to prevent OOM kills",
  },
  {
    id: "cost-004",
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    type: "optimization",
    resource: "batch-processor",
    namespace: "production",
    beforeCost: 15.00,
    afterCost: 9.00,
    savings: 6.00,
    description: "Right-sized resources based on usage patterns",
  },
  {
    id: "cost-005",
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    type: "scale-down",
    resource: "staging-services",
    namespace: "staging",
    beforeCost: 45.00,
    afterCost: 15.00,
    savings: 30.00,
    description: "Scaled down staging environment during off-hours",
  },
  {
    id: "cost-006",
    timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    type: "optimization",
    resource: "cache-service",
    namespace: "production",
    beforeCost: 20.00,
    afterCost: 12.00,
    savings: 8.00,
    description: "Optimized Redis memory allocation",
  },
];

export const mockCostTrends: CostTrend[] = [
  { date: "Week 1", actual: 2450, projected: 2800, optimized: 2200 },
  { date: "Week 2", actual: 2380, projected: 2850, optimized: 2150 },
  { date: "Week 3", actual: 2290, projected: 2900, optimized: 2100 },
  { date: "Week 4", actual: 2180, projected: 2950, optimized: 2050 },
];

export const mockEfficiencyData: ResourceEfficiency[] = [
  { resource: "api-gateway", namespace: "production", cpuRequested: 2000, cpuUsed: 1400, memoryRequested: 4096, memoryUsed: 2867, costPerHour: 2.50, efficiency: 70 },
  { resource: "user-service", namespace: "production", cpuRequested: 1000, cpuUsed: 450, memoryRequested: 2048, memoryUsed: 1024, costPerHour: 1.25, efficiency: 45 },
  { resource: "order-processor", namespace: "production", cpuRequested: 1500, cpuUsed: 1200, memoryRequested: 3072, memoryUsed: 2458, costPerHour: 1.88, efficiency: 80 },
  { resource: "payment-service", namespace: "production", cpuRequested: 1000, cpuUsed: 850, memoryRequested: 2048, memoryUsed: 1740, costPerHour: 1.25, efficiency: 85 },
  { resource: "notification-service", namespace: "production", cpuRequested: 500, cpuUsed: 150, memoryRequested: 1024, memoryUsed: 307, costPerHour: 0.63, efficiency: 30 },
  { resource: "batch-processor", namespace: "production", cpuRequested: 2000, cpuUsed: 600, memoryRequested: 4096, memoryUsed: 1229, costPerHour: 2.50, efficiency: 30 },
];

export function getCostStats() {
  const totalSavings = mockCostEvents
    .filter((e) => e.savings > 0)
    .reduce((sum, e) => sum + e.savings, 0);
  
  const totalCosts = mockCostEvents
    .filter((e) => e.savings < 0)
    .reduce((sum, e) => sum + Math.abs(e.savings), 0);

  const netSavings = totalSavings - totalCosts;

  const currentWeek = mockCostTrends[mockCostTrends.length - 1];
  const previousWeek = mockCostTrends[0];
  const costReduction = Math.round(((previousWeek.actual - currentWeek.actual) / previousWeek.actual) * 100);

  const avgEfficiency = Math.round(
    mockEfficiencyData.reduce((sum, r) => sum + r.efficiency, 0) / mockEfficiencyData.length
  );

  const overProvisionedResources = mockEfficiencyData.filter((r) => r.efficiency < 50).length;

  const projectedMonthlySavings = netSavings * 30;

  return {
    totalSavings,
    totalCosts,
    netSavings,
    costReduction,
    avgEfficiency,
    overProvisionedResources,
    projectedMonthlySavings,
    currentMonthlySpend: currentWeek.actual * 4,
    projectedWithoutOptimization: currentWeek.projected * 4,
  };
}
