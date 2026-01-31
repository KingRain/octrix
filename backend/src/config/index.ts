import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const configSchema = z.object({
  port: z.coerce.number().default(3001),
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  kubeConfigPath: z.string().optional(),
  k8sContext: z.string().optional(),
  clusters: z.array(z.object({
    id: z.string(),
    name: z.string(),
    prometheusUrl: z.string(),
    kubeConfigPath: z.string().optional(),
    k8sContext: z.string().optional(),
  })).default([
    {
      id: "cluster-1",
      name: "Cluster 1",
      prometheusUrl: "http://localhost:9090",
      kubeConfigPath: process.env.KUBECONFIG_PATH,
      k8sContext: "cluster1",
    },
    {
      id: "cluster-2",
      name: "Cluster 2",
      prometheusUrl: "http://localhost:9091",
      kubeConfigPath: process.env.KUBECONFIG_PATH,
      k8sContext: "cluster2",
    },
  ]),
  redis: z.object({
    host: z.string().default("localhost"),
    port: z.coerce.number().default(6379),
    password: z.string().optional(),
  }),
  jwt: z.object({
    secret: z.string().min(32),
    expiresIn: z.string().default("24h"),
  }),
  cors: z.object({
    origin: z.string().default("http://localhost:3000"),
  }),
  logging: z.object({
    level: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  }),
  rateLimit: z.object({
    windowMs: z.coerce.number().default(60000),
    maxRequests: z.coerce.number().default(100),
  }),
  prometheus: z.object({
    url: z.string().default("http://localhost:9090"),
    scrapeInterval: z.coerce.number().default(15000),
  }),
});

const configInput = {
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  kubeConfigPath: process.env.KUBECONFIG_PATH,
  k8sContext: process.env.K8S_CONTEXT,
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
  },
  jwt: {
    secret: process.env.JWT_SECRET || "development-secret-key-min-32-chars!",
    expiresIn: process.env.JWT_EXPIRES_IN,
  },
  cors: {
    origin: process.env.CORS_ORIGIN,
  },
  logging: {
    level: process.env.LOG_LEVEL,
  },
  rateLimit: {
    windowMs: process.env.RATE_LIMIT_WINDOW_MS,
    maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
  },
  prometheus: {
    url: process.env.PROMETHEUS_URL,
    scrapeInterval: process.env.PROMETHEUS_SCRAPE_INTERVAL,
  },
};

export const config = configSchema.parse(configInput);
export type Config = z.infer<typeof configSchema>;
