import { createChildLogger } from "../utils/logger.js";
import type { Incident, IncidentCategory, SLOBurnDriver } from "./types.js";

const logger = createChildLogger("slo-burn-classifier");

// Re-export SLOBurnDriver for convenience
export type { SLOBurnDriver } from "./types.js";

/**
 * Signals used for dynamic SLO burn driver classification
 */
export interface SLOBurnSignals {
  // Traffic signals
  rpsChangePercent?: number;           // % change in requests per second vs baseline
  rpsAbsolute?: number;                // Current RPS
  rpsBaseline?: number;                // Rolling baseline RPS

  // Quality signals
  errorRatePercent?: number;           // Current error rate %
  errorRateBaselinePercent?: number;   // Baseline error rate %
  latencyP50Ms?: number;               // Current P50 latency
  latencyP95Ms?: number;               // Current P95 latency
  latencyP99Ms?: number;               // Current P99 latency
  latencyBaselineP95Ms?: number;       // Baseline P95 latency

  // Resource saturation signals
  cpuUsagePercent?: number;            // Current CPU usage %
  memoryUsagePercent?: number;         // Current memory usage %
  cpuThrottled?: boolean;              // Whether CPU is throttled
  memoryPressure?: boolean;            // Whether under memory pressure

  // Capacity response signals
  replicasCurrent?: number;            // Current replica count
  replicasDesired?: number;            // HPA desired replicas
  replicasMax?: number;                // HPA max replicas
  scalingVelocity?: number;            // How fast scaling is happening (replicas/min)
  scalingEffectiveness?: number;       // 0-1 score of how well scaling is helping

  // Change correlation signals
  recentDeploymentMinutesAgo?: number; // Minutes since last deployment
  recentConfigChangeMinutesAgo?: number; // Minutes since last config change
  recentSecretChangeMinutesAgo?: number; // Minutes since last secret change
  deploymentCorrelationScore?: number; // 0-1 confidence that deployment caused issue

  // Pod health signals
  restartCount?: number;               // Container restart count
  oomKilled?: boolean;                 // OOM killed recently
  crashLoopBackoff?: boolean;          // In CrashLoopBackOff state

  // Additional context
  affectedPodCount?: number;           // Number of affected pods
  affectedNodeCount?: number;          // Number of affected nodes
  cascadingFailure?: boolean;          // Whether this is cascading
}

/**
 * Classification result with confidence and evidence
 */
export interface SLOBurnClassification {
  driver: SLOBurnDriver;
  confidence: number;                  // 0-1 confidence in classification
  evidence: string;                    // Human-readable evidence summary
  signals: SLOBurnSignalScores;        // Individual signal contributions
}

/**
 * Scores for each signal category (0-1 range, higher = more likely the cause)
 */
export interface SLOBurnSignalScores {
  trafficScore: number;                // How much traffic contributes to the burn
  qualityScore: number;                // How much quality degradation contributes
  resourceScore: number;               // How much resource saturation contributes
  capacityScore: number;               // How much capacity issues contribute
  changeScore: number;                 // How much recent changes contribute
}

/**
 * Thresholds for classification decisions
 */
const THRESHOLDS = {
  // Traffic thresholds
  RPS_SURGE_PERCENT: 50,               // >50% RPS increase = surge
  RPS_MODERATE_INCREASE_PERCENT: 20,   // >20% = moderate increase

  // Quality thresholds  
  ERROR_RATE_HIGH_PERCENT: 5,          // >5% error rate = high
  ERROR_RATE_ELEVATED_PERCENT: 1,      // >1% = elevated
  LATENCY_DEGRADATION_MULTIPLIER: 2,   // 2x baseline = degradation
  LATENCY_HIGH_MULTIPLIER: 1.5,        // 1.5x baseline = elevated

  // Resource thresholds
  CPU_CRITICAL_PERCENT: 90,            // >90% = critical
  CPU_HIGH_PERCENT: 75,                // >75% = high
  MEMORY_CRITICAL_PERCENT: 90,         // >90% = critical
  MEMORY_HIGH_PERCENT: 75,             // >75% = high

  // Capacity thresholds
  SCALING_LAG_THRESHOLD: 0.2,          // Desired - Current > 20% of max = lag
  MAX_REPLICAS_REACHED_PERCENT: 90,    // >90% of max replicas = capacity limit

  // Change correlation thresholds
  RECENT_CHANGE_WINDOW_MINUTES: 30,    // Changes within 30 min are recent
  VERY_RECENT_CHANGE_MINUTES: 10,      // Changes within 10 min are very recent

  // Classification thresholds
  DRIVER_CONFIDENCE_THRESHOLD: 0.6,    // >60% confidence to pick a driver
  MIXED_RANGE: 0.3,                    // If scores are within 30%, classify as mixed
};

/**
 * Classifies the SLO burn driver based on available signals
 */
export function classifySLOBurnDriver(
  signals: SLOBurnSignals,
  category: IncidentCategory
): SLOBurnClassification {
  const scores = computeSignalScores(signals, category);
  const { driver, confidence } = determineDriver(scores);
  const evidence = buildEvidenceString(signals, scores, driver);

  logger.debug({
    category,
    driver,
    confidence,
    scores,
  }, "SLO burn driver classified");

  return {
    driver,
    confidence,
    evidence,
    signals: scores,
  };
}

/**
 * Compute individual signal scores (0-1 range)
 */
function computeSignalScores(
  signals: SLOBurnSignals,
  category: IncidentCategory
): SLOBurnSignalScores {
  return {
    trafficScore: computeTrafficScore(signals),
    qualityScore: computeQualityScore(signals, category),
    resourceScore: computeResourceScore(signals, category),
    capacityScore: computeCapacityScore(signals),
    changeScore: computeChangeScore(signals, category),
  };
}

/**
 * Compute traffic signal score (0-1)
 */
function computeTrafficScore(signals: SLOBurnSignals): number {
  let score = 0;
  let factors = 0;

  // RPS change analysis
  if (signals.rpsChangePercent !== undefined) {
    factors++;
    if (signals.rpsChangePercent >= THRESHOLDS.RPS_SURGE_PERCENT) {
      score += 1.0;
    } else if (signals.rpsChangePercent >= THRESHOLDS.RPS_MODERATE_INCREASE_PERCENT) {
      score += 0.6;
    } else if (signals.rpsChangePercent > 0) {
      score += 0.3;
    }
  }

  // If we have absolute RPS and baseline, compute additional score
  if (signals.rpsAbsolute !== undefined && signals.rpsBaseline !== undefined && signals.rpsBaseline > 0) {
    factors++;
    const ratio = signals.rpsAbsolute / signals.rpsBaseline;
    if (ratio >= 1.5) {
      score += 1.0;
    } else if (ratio >= 1.2) {
      score += 0.6;
    } else if (ratio >= 1.1) {
      score += 0.3;
    }
  }

  // Scaling velocity indicates traffic pressure
  if (signals.scalingVelocity !== undefined && signals.scalingVelocity > 0) {
    factors++;
    score += Math.min(signals.scalingVelocity / 5, 1.0); // 5 replicas/min = max score
  }

  return factors > 0 ? score / factors : 0;
}

/**
 * Compute quality degradation score (0-1)
 */
function computeQualityScore(signals: SLOBurnSignals, category: IncidentCategory): number {
  let score = 0;
  let factors = 0;

  // Error rate analysis
  if (signals.errorRatePercent !== undefined) {
    factors++;
    if (signals.errorRatePercent >= THRESHOLDS.ERROR_RATE_HIGH_PERCENT) {
      score += 1.0;
    } else if (signals.errorRatePercent >= THRESHOLDS.ERROR_RATE_ELEVATED_PERCENT) {
      score += 0.6;
    } else if (signals.errorRatePercent > 0) {
      score += 0.3;
    }
  }

  // Error rate spike vs baseline
  if (signals.errorRatePercent !== undefined && signals.errorRateBaselinePercent !== undefined) {
    factors++;
    if (signals.errorRateBaselinePercent > 0) {
      const ratio = signals.errorRatePercent / signals.errorRateBaselinePercent;
      score += Math.min(ratio / 3, 1.0); // 3x baseline = max score
    } else if (signals.errorRatePercent > 0) {
      score += 1.0; // Any errors when baseline is 0
    }
  }

  // Latency degradation
  if (signals.latencyP95Ms !== undefined && signals.latencyBaselineP95Ms !== undefined && signals.latencyBaselineP95Ms > 0) {
    factors++;
    const ratio = signals.latencyP95Ms / signals.latencyBaselineP95Ms;
    if (ratio >= THRESHOLDS.LATENCY_DEGRADATION_MULTIPLIER) {
      score += 1.0;
    } else if (ratio >= THRESHOLDS.LATENCY_HIGH_MULTIPLIER) {
      score += 0.6;
    } else if (ratio > 1.0) {
      score += 0.3;
    }
  }

  // Category-based adjustments for known degradation patterns
  const degradationCategories: IncidentCategory[] = [
    "crash-loop",
    "oom-killed",
    "buggy-deployment",
    "configmap-error",
    "db-failure",
    "unknown-crash",
  ];

  if (degradationCategories.includes(category)) {
    factors++;
    score += 0.8; // Strong signal that this is a degradation issue
  }

  // Restart count indicates instability
  if (signals.restartCount !== undefined && signals.restartCount > 0) {
    factors++;
    score += Math.min(signals.restartCount / 5, 1.0); // 5+ restarts = max score
  }

  // OOM or crash loop are strong degradation indicators
  if (signals.oomKilled || signals.crashLoopBackoff) {
    factors++;
    score += 1.0;
  }

  return factors > 0 ? score / factors : 0;
}

/**
 * Compute resource saturation score (0-1)
 */
function computeResourceScore(signals: SLOBurnSignals, category: IncidentCategory): number {
  let score = 0;
  let factors = 0;

  // CPU saturation
  if (signals.cpuUsagePercent !== undefined) {
    factors++;
    if (signals.cpuUsagePercent >= THRESHOLDS.CPU_CRITICAL_PERCENT) {
      score += 1.0;
    } else if (signals.cpuUsagePercent >= THRESHOLDS.CPU_HIGH_PERCENT) {
      score += 0.6;
    } else if (signals.cpuUsagePercent >= 50) {
      score += 0.3;
    }
  }

  // Memory saturation
  if (signals.memoryUsagePercent !== undefined) {
    factors++;
    if (signals.memoryUsagePercent >= THRESHOLDS.MEMORY_CRITICAL_PERCENT) {
      score += 1.0;
    } else if (signals.memoryUsagePercent >= THRESHOLDS.MEMORY_HIGH_PERCENT) {
      score += 0.6;
    } else if (signals.memoryUsagePercent >= 50) {
      score += 0.3;
    }
  }

  // CPU throttling
  if (signals.cpuThrottled) {
    factors++;
    score += 0.8;
  }

  // Memory pressure
  if (signals.memoryPressure) {
    factors++;
    score += 0.9;
  }

  // Category-based adjustments for resource issues
  const resourceCategories: IncidentCategory[] = [
    "high-cpu",
    "high-memory",
    "pod-throttling",
    "node-pressure",
  ];

  if (resourceCategories.includes(category)) {
    factors++;
    score += 0.7;
  }

  return factors > 0 ? score / factors : 0;
}

/**
 * Compute capacity response score (0-1)
 * High score = scaling is struggling to keep up (traffic-driven)
 * Low score = scaling is adequate or not needed
 */
function computeCapacityScore(signals: SLOBurnSignals): number {
  let score = 0;
  let factors = 0;

  // Check if at max replicas (capacity ceiling)
  if (signals.replicasCurrent !== undefined && signals.replicasMax !== undefined && signals.replicasMax > 0) {
    factors++;
    const utilization = signals.replicasCurrent / signals.replicasMax;
    if (utilization >= THRESHOLDS.MAX_REPLICAS_REACHED_PERCENT / 100) {
      score += 1.0; // At capacity ceiling = traffic pressure
    } else if (utilization >= 0.7) {
      score += 0.6;
    }
  }

  // Check scaling lag (desired > current)
  if (signals.replicasCurrent !== undefined && signals.replicasDesired !== undefined && signals.replicasMax !== undefined) {
    factors++;
    const lag = (signals.replicasDesired - signals.replicasCurrent) / signals.replicasMax;
    if (lag > THRESHOLDS.SCALING_LAG_THRESHOLD) {
      score += 0.8; // Scaling can't keep up = traffic pressure
    } else if (lag > 0) {
      score += 0.4;
    }
  }

  // Scaling effectiveness
  if (signals.scalingEffectiveness !== undefined) {
    factors++;
    // Low effectiveness with active scaling = traffic overwhelming capacity
    if (signals.scalingEffectiveness < 0.5 && signals.scalingVelocity && signals.scalingVelocity > 0) {
      score += 0.8;
    } else if (signals.scalingEffectiveness < 0.3) {
      score += 0.5;
    }
  }

  return factors > 0 ? score / factors : 0;
}

/**
 * Compute change correlation score (0-1)
 * High score = recent change likely caused the issue (degradation)
 */
function computeChangeScore(signals: SLOBurnSignals, category: IncidentCategory): number {
  let score = 0;
  let factors = 0;

  // Deployment correlation
  if (signals.recentDeploymentMinutesAgo !== undefined) {
    factors++;
    if (signals.recentDeploymentMinutesAgo <= THRESHOLDS.VERY_RECENT_CHANGE_MINUTES) {
      score += 1.0; // Very recent deployment = strong correlation
    } else if (signals.recentDeploymentMinutesAgo <= THRESHOLDS.RECENT_CHANGE_WINDOW_MINUTES) {
      score += 0.7; // Recent deployment = moderate correlation
    } else if (signals.recentDeploymentMinutesAgo <= 60) {
      score += 0.3; // Within an hour = weak correlation
    }
  }

  // Config change correlation
  if (signals.recentConfigChangeMinutesAgo !== undefined) {
    factors++;
    if (signals.recentConfigChangeMinutesAgo <= THRESHOLDS.VERY_RECENT_CHANGE_MINUTES) {
      score += 1.0;
    } else if (signals.recentConfigChangeMinutesAgo <= THRESHOLDS.RECENT_CHANGE_WINDOW_MINUTES) {
      score += 0.7;
    }
  }

  // Explicit deployment correlation score from external system
  if (signals.deploymentCorrelationScore !== undefined) {
    factors++;
    score += signals.deploymentCorrelationScore;
  }

  // Category-based adjustments for change-related issues
  const changeCategories: IncidentCategory[] = [
    "buggy-deployment",
    "configmap-error",
  ];

  if (changeCategories.includes(category)) {
    factors++;
    score += 0.9; // Strong signal of change-related issue
  }

  return factors > 0 ? score / factors : 0;
}

/**
 * Determine the final driver based on computed scores
 */
function determineDriver(scores: SLOBurnSignalScores): { driver: SLOBurnDriver; confidence: number } {
  // Traffic-driven signals: traffic + resource + capacity
  const trafficDrivenScore = (scores.trafficScore * 0.5 + scores.resourceScore * 0.25 + scores.capacityScore * 0.25);
  
  // Degradation-driven signals: quality + change
  const degradationDrivenScore = (scores.qualityScore * 0.6 + scores.changeScore * 0.4);

  // Calculate difference for confidence
  const scoreDiff = Math.abs(trafficDrivenScore - degradationDrivenScore);
  const maxScore = Math.max(trafficDrivenScore, degradationDrivenScore);

  // If scores are too close, it's mixed
  if (scoreDiff < THRESHOLDS.MIXED_RANGE && maxScore > 0.2) {
    return {
      driver: "mixed",
      confidence: 1 - (scoreDiff / THRESHOLDS.MIXED_RANGE) * 0.5, // Higher confidence when scores are very close
    };
  }

  // If neither score is significant, it's mixed (unknown)
  if (maxScore < 0.3) {
    return {
      driver: "mixed",
      confidence: 0.5,
    };
  }

  // Clear winner
  if (trafficDrivenScore > degradationDrivenScore) {
    return {
      driver: "traffic-surge",
      confidence: Math.min(trafficDrivenScore, 1.0),
    };
  } else {
    return {
      driver: "degradation",
      confidence: Math.min(degradationDrivenScore, 1.0),
    };
  }
}

/**
 * Build a human-readable evidence string
 */
function buildEvidenceString(
  signals: SLOBurnSignals,
  scores: SLOBurnSignalScores,
  driver: SLOBurnDriver
): string {
  const parts: string[] = [];

  // Traffic evidence
  if (signals.rpsChangePercent !== undefined && signals.rpsChangePercent > 10) {
    parts.push(`RPS +${Math.round(signals.rpsChangePercent)}%`);
  }

  // Quality evidence
  if (signals.errorRatePercent !== undefined && signals.errorRatePercent > 0.5) {
    parts.push(`error rate ${signals.errorRatePercent.toFixed(1)}%`);
  }

  if (signals.latencyP95Ms !== undefined && signals.latencyBaselineP95Ms !== undefined) {
    const ratio = signals.latencyP95Ms / signals.latencyBaselineP95Ms;
    if (ratio > 1.2) {
      parts.push(`P95 +${Math.round((ratio - 1) * 100)}%`);
    }
  }

  // Resource evidence
  if (signals.cpuUsagePercent !== undefined && signals.cpuUsagePercent > 70) {
    parts.push(`CPU ${Math.round(signals.cpuUsagePercent)}%`);
  }

  if (signals.memoryUsagePercent !== undefined && signals.memoryUsagePercent > 70) {
    parts.push(`memory ${Math.round(signals.memoryUsagePercent)}%`);
  }

  // Restart/crash evidence
  if (signals.restartCount !== undefined && signals.restartCount > 2) {
    parts.push(`${signals.restartCount} restarts`);
  }

  if (signals.oomKilled) {
    parts.push("OOM killed");
  }

  // Capacity evidence
  if (signals.replicasCurrent !== undefined && signals.replicasMax !== undefined) {
    const atCapacity = signals.replicasCurrent / signals.replicasMax >= 0.9;
    if (atCapacity) {
      parts.push("at max replicas");
    }
  }

  // Change evidence
  if (signals.recentDeploymentMinutesAgo !== undefined && signals.recentDeploymentMinutesAgo <= 30) {
    parts.push(`deployment ${signals.recentDeploymentMinutesAgo}m ago`);
  }

  // Build final string
  if (parts.length === 0) {
    return driver === "traffic-surge" 
      ? "Traffic-driven SLO burn detected"
      : driver === "degradation"
      ? "Quality degradation detected"
      : "Multiple contributing factors";
  }

  return parts.join(", ");
}

/**
 * Quick classification for incidents that don't have rich signals
 * Falls back to category-based heuristics
 */
export function classifySLOBurnDriverFromCategory(category: IncidentCategory): SLOBurnClassification {
  // Traffic-surge categories (load-driven)
  const trafficCategories: IncidentCategory[] = [
    "high-cpu",
    "high-memory",
    "pod-throttling",
  ];

  // Degradation categories (quality/bug-driven)
  const degradationCategories: IncidentCategory[] = [
    "crash-loop",
    "oom-killed",
    "buggy-deployment",
    "configmap-error",
    "db-failure",
    "unknown-crash",
  ];

  if (trafficCategories.includes(category)) {
    return {
      driver: "traffic-surge",
      confidence: 0.7,
      evidence: "Category indicates traffic-driven issue",
      signals: {
        trafficScore: 0.7,
        qualityScore: 0.2,
        resourceScore: 0.8,
        capacityScore: 0.5,
        changeScore: 0.1,
      },
    };
  }

  if (degradationCategories.includes(category)) {
    return {
      driver: "degradation",
      confidence: 0.7,
      evidence: "Category indicates quality degradation",
      signals: {
        trafficScore: 0.2,
        qualityScore: 0.8,
        resourceScore: 0.3,
        capacityScore: 0.1,
        changeScore: 0.5,
      },
    };
  }

  return {
    driver: "mixed",
    confidence: 0.5,
    evidence: "Unable to determine primary driver",
    signals: {
      trafficScore: 0.5,
      qualityScore: 0.5,
      resourceScore: 0.5,
      capacityScore: 0.5,
      changeScore: 0.5,
    },
  };
}

/**
 * Enrich an incident with SLO burn classification
 */
export function enrichIncidentWithSLOBurn(
  incident: Incident,
  signals?: Partial<SLOBurnSignals>
): { sloBurnDriver: SLOBurnDriver; evidence: string; confidence: number } {
  // Build signals from incident metrics
  const computedSignals: SLOBurnSignals = {
    cpuUsagePercent: typeof incident.metrics.cpuUsage === "number" ? incident.metrics.cpuUsage : undefined,
    memoryUsagePercent: typeof incident.metrics.memoryUsage === "number" ? incident.metrics.memoryUsage : undefined,
    restartCount: typeof incident.metrics.restartCount === "number" ? incident.metrics.restartCount : undefined,
    oomKilled: incident.category === "oom-killed",
    crashLoopBackoff: incident.category === "crash-loop",
    errorRatePercent: typeof incident.metrics.errorRate === "number" ? incident.metrics.errorRate : undefined,
    ...signals,
  };

  // If we have minimal signals, fall back to category-based classification
  const hasRichSignals = Object.values(computedSignals).some(
    (v) => v !== undefined && v !== false && v !== 0
  );

  const classification = hasRichSignals
    ? classifySLOBurnDriver(computedSignals, incident.category)
    : classifySLOBurnDriverFromCategory(incident.category);

  return {
    sloBurnDriver: classification.driver,
    evidence: classification.evidence,
    confidence: classification.confidence,
  };
}
