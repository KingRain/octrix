import { createChildLogger } from "../utils/logger.js";
import type { SLOBurnDriver } from "../incidents/types.js";

const logger = createChildLogger("gemini-classifier");

interface GeminiSLOBurnResult {
  driver: SLOBurnDriver;
  confidence: number;
  evidence: string;
}

export class GeminiClassifierService {
  async analyzeSLOBurn(
    simulationType: string,
    simulatedLogs: string,
    simulatedMetrics: Record<string, any>
  ): Promise<GeminiSLOBurnResult> {
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      logger.warn("GEMINI_API_KEY not configured, classifying with fallback heuristics");
      return this.getFallbackClassification(simulationType);
    }

    try {
      const prompt = `
You are a Site Reliability Engineer (SRE) Expert analyzing a Kubernetes incident.
Determine the "SLO Burn Driver" (the primary cause of the reliability loss) based on the logs and metrics provided.

Possible Drivers:
1. "traffic-surge": Issue caused by increased load/traffic (e.g. CPU saturation, capacity limit).
2. "degradation": Issue caused by bugs, quality issues, or configuration errors (e.g. 500 errors, latency without load, crashes).
3. "mixed": Valid combination of both (e.g. high load triggering a bug).

Input Data:
- Simulation Type: ${simulationType}
- Simulated Logs:
${simulatedLogs}
- Simulated Metrics:
${JSON.stringify(simulatedMetrics, null, 2)}

Instructions:
Analyze the input to determine the underlying driver.
- If response time is high but CPU/Traffic is low, it's likely "degradation".
- If errors are 5xx and load is normal, it's "degradation".
- If CPU is throttled or memory is OOMing due to request volume, it's "traffic-surge".
- If "Readiness Probe" is lying (200 OK) but deep checks fail, it is "degradation".
- If "Config Drift" is detected, it is "degradation" (operational change).
- If network drops packets (Blackhole), it is "degradation" (infrastructure/config failure).

Output JSON ONLY:
{
  "driver": "traffic-surge" | "degradation" | "mixed",
  "confidence": <number between 0.0 and 1.0>,
  "evidence": "<concise one-sentence explanation of WHY>"
}
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error("Empty response from Gemini");
      }

      const result = JSON.parse(text);
      
      // Validate result
      if (!["traffic-surge", "degradation", "mixed"].includes(result.driver)) {
        result.driver = "mixed";
      }

      return {
        driver: result.driver as SLOBurnDriver,
        confidence: Number(result.confidence) || 0.5,
        evidence: result.evidence || "Analyzed via Gemini AI",
      };

    } catch (error) {
      logger.error({ error }, "Failed to classify with Gemini");
      return this.getFallbackClassification(simulationType);
    }
  }

  private getFallbackClassification(type: string): GeminiSLOBurnResult {
    // Fallback logic if API fails or key is missing
    switch (type) {
      case "pod-running-app-broken":
      case "readiness-lies":
      case "config-drift":
      case "network-blackhole":
        return {
          driver: "degradation",
          confidence: 0.85,
          evidence: "Heuristic fallback: Pattern matches known degradation scenario",
        };
      default:
        return {
          driver: "mixed",
          confidence: 0.5,
          evidence: "Heuristic fallback: Unknown pattern",
        };
    }
  }
}

export const geminiClassifier = new GeminiClassifierService();
