import { api } from "./api";
import type { ApiEnvelope } from "./types";

export type OpsLiveMetricRow = {
  provider: string;
  model: string;
  ai_requests_total: number;
  ai_request_status: { ok: number; error: number; cancelled: number };
  ai_request_latency_ms: { p50: number; p95: number; p99: number };
  ai_ttft_ms: { p50: number; p95: number; p99: number };
  ai_stream_duration_ms: { p50: number; p95: number; p99: number };
  ai_retries_total: number;
  ai_tokens_total: { prompt: number; completion: number; total: number };
  ai_cost_usd_total: number;
  ai_regen_total: number;
  estimator_rate: number;
};

export type OpsProviderHealth = {
  provider: string;
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  breakerState: "CLOSED" | "OPEN" | "HALF_OPEN";
  errorRate: number;
  timeoutRate: number;
  rollingLatencyP95Ms: number | null;
  updatedAt: string;
  lastCheckedAt: string | null;
};

export type OpsLiveMetricsResponse = {
  windowHours: number;
  paywallBlocks: number;
  providerHealth: OpsProviderHealth[];
  metrics: OpsLiveMetricRow[];
};

export type DailyAiCostRow = {
  id: string;
  date: string;
  provider: string;
  model: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  creditsCharged: number;
  refunds: number;
  paywallBlocks: number;
  regenCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  revenueUsd: number;
  marginUsd: number;
  marginPct: number;
};

export type OpsDailyDashboardResponse = {
  days: number;
  from: string;
  rows: DailyAiCostRow[];
};

export type OpsAlertRecord = {
  id: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  message: string;
  provider: string | null;
  model: string | null;
  triggeredAt: string;
  details: unknown;
};

export const fetchOpsLiveMetrics = async (hours = 24) => {
  const response = await api.get<ApiEnvelope<OpsLiveMetricsResponse>>(
    `/ops/metrics/live?hours=${encodeURIComponent(String(hours))}`
  );
  return response.data.data;
};

export const fetchOpsDailyDashboard = async (days = 7) => {
  const response = await api.get<ApiEnvelope<OpsDailyDashboardResponse>>(
    `/ops/dashboard/daily?days=${encodeURIComponent(String(days))}`
  );
  return response.data.data;
};

export const fetchOpsAlerts = async (limit = 100) => {
  const response = await api.get<ApiEnvelope<{ alerts: OpsAlertRecord[] }>>(
    `/ops/alerts?limit=${encodeURIComponent(String(limit))}`
  );
  return response.data.data.alerts;
};
