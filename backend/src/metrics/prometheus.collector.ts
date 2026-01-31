import { createChildLogger } from "../utils/logger.js";
import { config } from "../config/index.js";

const logger = createChildLogger("prometheus-collector");

export interface PrometheusQueryResult {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      metric: Record<string, string>;
      value: [number, string];
    }>;
  };
}

export interface PrometheusRangeResult {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      metric: Record<string, string>;
      values: Array<[number, string]>;
    }>;
  };
}

export class PrometheusCollector {
  private baseUrl: string;
  private isConnected: boolean = false;
  private lastCheckTime: number = 0;
  private checkInterval: number = 30000;

  constructor() {
    this.baseUrl = config.prometheus?.url || "http://localhost:9090";
    logger.info({ url: this.baseUrl }, "Prometheus collector initialized");
  }

  async checkConnection(): Promise<boolean> {
    const now = Date.now();
    
    if (now - this.lastCheckTime < this.checkInterval && this.lastCheckTime > 0) {
      return this.isConnected;
    }
    
    this.lastCheckTime = now;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/api/v1/status/config`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      this.isConnected = response.ok;
      
      if (this.isConnected) {
        logger.info({ url: this.baseUrl }, "Prometheus connected successfully");
      } else {
        logger.warn({ url: this.baseUrl, status: response.status }, "Prometheus returned non-OK status");
      }
      
      return this.isConnected;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      if (errorMessage.includes("abort") || errorMessage.includes("timeout")) {
        logger.warn({ url: this.baseUrl }, "Prometheus connection timed out, using mock data");
      } else {
        logger.warn({ url: this.baseUrl, error: errorMessage }, "Prometheus connection failed, using mock data");
      }
      
      this.isConnected = false;
      return false;
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async query(promql: string): Promise<PrometheusQueryResult | null> {
    if (!this.isConnected) {
      await this.checkConnection();
    }
    
    if (!this.isConnected) {
      return null;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const url = `${this.baseUrl}/api/v1/query?query=${encodeURIComponent(promql)}`;
      const response = await fetch(url, { signal: controller.signal });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Prometheus query failed: ${response.statusText}`);
      }
      
      return (await response.json()) as PrometheusQueryResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error({ error: errorMessage, query: promql }, "Prometheus query error");
      return null;
    }
  }

  async queryRange(
    promql: string,
    start: number,
    end: number,
    step: string
  ): Promise<PrometheusRangeResult | null> {
    if (!this.isConnected) {
      await this.checkConnection();
    }
    
    if (!this.isConnected) {
      return null;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const url = `${this.baseUrl}/api/v1/query_range?query=${encodeURIComponent(promql)}&start=${start}&end=${end}&step=${step}`;
      const response = await fetch(url, { signal: controller.signal });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Prometheus range query failed: ${response.statusText}`);
      }
      
      return (await response.json()) as PrometheusRangeResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error({ error: errorMessage, query: promql }, "Prometheus range query error");
      return null;
    }
  }
  
  getStatus(): { connected: boolean; url: string; lastCheck: string } {
    return {
      connected: this.isConnected,
      url: this.baseUrl,
      lastCheck: this.lastCheckTime > 0 ? new Date(this.lastCheckTime).toISOString() : "never",
    };
  }

  extractValue(result: PrometheusQueryResult | null): number | null {
    if (!result?.data?.result?.[0]?.value?.[1]) {
      return null;
    }
    return parseFloat(result.data.result[0].value[1]);
  }

  extractValues(result: PrometheusQueryResult | null): Array<{ labels: Record<string, string>; value: number }> {
    if (!result?.data?.result) {
      return [];
    }
    return result.data.result.map((r) => ({
      labels: r.metric,
      value: parseFloat(r.value[1]),
    }));
  }
}

export const prometheusCollector = new PrometheusCollector();
