import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../middlewares/errorHandler";
import { aiService, type ChatModel } from "./ai.service";
import { securityService } from "../security/security.service";

type ProviderName = "openrouter" | "openai" | "anthropic" | "gemini" | "xai";
type ProviderKey = "openrouter" | "openai" | "claude" | "gemini" | "grok";

const providerFromModel = (model: ProviderKey): ProviderName => {
  if (model === "openrouter") return "openrouter";
  if (model === "openai") return "openai";
  if (model === "claude") return "anthropic";
  if (model === "gemini") return "gemini";
  return "xai";
};
const CircuitBreakerState = {
  CLOSED: "CLOSED",
  OPEN: "OPEN",
  HALF_OPEN: "HALF_OPEN",
} as const;
const ProviderHealthStatus = {
  HEALTHY: "HEALTHY",
  DEGRADED: "DEGRADED",
  DOWN: "DOWN",
} as const;

const allModels: ProviderKey[] = ["openrouter", "openai", "claude", "gemini", "grok"];
const inMemory = new Map<ProviderName, { updatedAt: number; data: Awaited<ReturnType<typeof getOrCreateHealth>> }>();

const percentile = (values: number[], p: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

async function getOrCreateHealth(provider: ProviderName) {
  return (prisma as any).aiProviderHealth.upsert({
    where: { provider },
    create: { provider },
    update: {},
  });
}

const classifyError = (error: unknown) => {
  if (!(error instanceof Error)) return "unknown";
  if (/timeout|timed out|abort/i.test(error.message)) return "timeout";
  if (/401|403|auth|unauthorized|forbidden/i.test(error.message)) return "auth";
  if (/quota|rate limit|429/i.test(error.message)) return "quota";
  if (/5\d\d/.test(error.message)) return "5xx";
  if (/4\d\d/.test(error.message)) return "4xx";
  return "unknown";
};

const shouldOpenCircuit = (health: any) => {
  return (
    health.errorRate > env.AI_CB_ERROR_RATE_THRESHOLD ||
    health.timeoutRate > env.AI_CB_TIMEOUT_RATE_THRESHOLD ||
    health.consecutiveFailures >= env.AI_CB_CONSEC_FAIL_THRESHOLD ||
    (health.rollingLatencyP95Ms ?? 0) > env.AI_CB_P95_LATENCY_THRESHOLD_MS
  );
};

const computeStatus = (health: any) => {
  if (health.breakerState === CircuitBreakerState.OPEN) return ProviderHealthStatus.DOWN;
  if (
    health.errorRate > env.AI_CB_ERROR_RATE_THRESHOLD / 2 ||
    health.timeoutRate > env.AI_CB_TIMEOUT_RATE_THRESHOLD / 2 ||
    (health.rollingLatencyP95Ms ?? 0) > env.AI_CB_P95_LATENCY_THRESHOLD_MS * 0.7
  ) {
    return ProviderHealthStatus.DEGRADED;
  }
  return ProviderHealthStatus.HEALTHY;
};

const parseSamples = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "number") as number[];
};

const updateHealthAfterOutcome = async (input: {
  provider: ProviderName;
  success: boolean;
  latencyMs: number;
  errorType?: string;
}) => {
  const now = new Date();
  const current = await getOrCreateHealth(input.provider);
  const windowAgeMs = now.getTime() - current.windowStartedAt.getTime();
  const resetWindow = windowAgeMs > 5 * 60_000;

  const baseReqCount = resetWindow ? 0 : current.windowRequestCount;
  const baseErrCount = resetWindow ? 0 : current.windowErrorCount;
  const baseTimeoutCount = resetWindow ? 0 : current.windowTimeoutCount;
  const nextReqCount = baseReqCount + 1;
  const nextErrCount = baseErrCount + (input.success ? 0 : 1);
  const nextTimeoutCount = baseTimeoutCount + (input.errorType === "timeout" ? 1 : 0);

  const existingSamples = resetWindow ? [] : parseSamples(current.latencySamples);
  const nextSamples = [...existingSamples.slice(-99), input.latencyMs];
  const p50 = percentile(nextSamples, 50);
  const p95 = percentile(nextSamples, 95);

  let breakerState = current.breakerState;
  let openUntil = current.openUntil;
  let halfOpenTrialCount = current.halfOpenTrialCount;
  let halfOpenSuccessCount = current.halfOpenSuccessCount;

  if (breakerState === CircuitBreakerState.HALF_OPEN) {
    if (input.success) {
      halfOpenSuccessCount += 1;
      if (halfOpenSuccessCount >= env.AI_CB_HALF_OPEN_TRIALS) {
        breakerState = CircuitBreakerState.CLOSED;
        halfOpenTrialCount = 0;
        halfOpenSuccessCount = 0;
        openUntil = null;
      }
    } else {
      breakerState = CircuitBreakerState.OPEN;
      openUntil = new Date(now.getTime() + env.AI_CB_OPEN_DURATION_MS);
      halfOpenTrialCount = 0;
      halfOpenSuccessCount = 0;
    }
  } else if (breakerState === CircuitBreakerState.CLOSED) {
    const simulated = {
      ...current,
      errorRate: nextReqCount > 0 ? nextErrCount / nextReqCount : 0,
      timeoutRate: nextReqCount > 0 ? nextTimeoutCount / nextReqCount : 0,
      consecutiveFailures: input.success ? 0 : current.consecutiveFailures + 1,
      rollingLatencyP95Ms: p95,
    };
    if (shouldOpenCircuit(simulated)) {
      breakerState = CircuitBreakerState.OPEN;
      openUntil = new Date(now.getTime() + env.AI_CB_OPEN_DURATION_MS);
      halfOpenTrialCount = 0;
      halfOpenSuccessCount = 0;
      console.warn(
        JSON.stringify({
          event: "ai.circuit.open",
          provider: input.provider,
          errorRate: simulated.errorRate,
          timeoutRate: simulated.timeoutRate,
          p95LatencyMs: simulated.rollingLatencyP95Ms,
          consecutiveFailures: simulated.consecutiveFailures,
          at: now.toISOString(),
        })
      );
      void securityService.logSecurityEvent({
        type: "CIRCUIT_OPEN",
        details: {
          provider: input.provider,
          errorRate: simulated.errorRate,
          timeoutRate: simulated.timeoutRate,
          p95LatencyMs: simulated.rollingLatencyP95Ms,
          consecutiveFailures: simulated.consecutiveFailures,
        },
      });
    }
  }

  const updated = await (prisma as any).aiProviderHealth.update({
    where: { provider: input.provider },
    data: {
      status: computeStatus({
        ...current,
        breakerState,
        errorRate: nextReqCount > 0 ? nextErrCount / nextReqCount : 0,
        timeoutRate: nextReqCount > 0 ? nextTimeoutCount / nextReqCount : 0,
        rollingLatencyP95Ms: p95,
      }),
      breakerState,
      lastCheckedAt: now,
      rollingLatencyP50Ms: p50,
      rollingLatencyP95Ms: p95,
      errorRate: nextReqCount > 0 ? nextErrCount / nextReqCount : 0,
      timeoutRate: nextReqCount > 0 ? nextTimeoutCount / nextReqCount : 0,
      consecutiveFailures: input.success ? 0 : current.consecutiveFailures + 1,
      consecutiveSuccesses: input.success ? current.consecutiveSuccesses + 1 : 0,
      windowStartedAt: resetWindow ? now : current.windowStartedAt,
      windowRequestCount: nextReqCount,
      windowErrorCount: nextErrCount,
      windowTimeoutCount: nextTimeoutCount,
      latencySamples: nextSamples as Prisma.InputJsonValue,
      openUntil,
      halfOpenTrialCount,
      halfOpenSuccessCount,
    },
  });
  inMemory.set(input.provider, { updatedAt: Date.now(), data: updated });
  return updated;
};

const getHealth = async (provider: ProviderName) => {
  const cached = inMemory.get(provider);
  if (cached && Date.now() - cached.updatedAt < 5000) return cached.data;
  const health = await getOrCreateHealth(provider);
  inMemory.set(provider, { updatedAt: Date.now(), data: health });
  return health;
};

const getAllProviderHealth = async () => {
  const items = await Promise.all(
    (["openrouter", "openai", "anthropic", "gemini", "xai"] as ProviderName[]).map(
      async (provider) => {
        const health = await getHealth(provider);
        return { provider, ...health };
      }
    )
  );
  for (const item of items) {
    if (item.status === ProviderHealthStatus.DOWN) {
      void securityService.logSecurityEvent({
        type: "PROVIDER_DOWN",
        details: {
          provider: item.provider,
          breakerState: item.breakerState,
          errorRate: item.errorRate,
          timeoutRate: item.timeoutRate,
        },
      });
    }
  }
  return items;
};

const getSuggestedFallbackModels = async (currentModel: ProviderKey) => {
  const enabled = aiService.listEnabledModels();
  const order = env.AI_FALLBACK_ORDER.split(",").map((item) => item.trim().toLowerCase());
  const fallbackModels = order.filter((model) => enabled.includes(model as ChatModel)) as ProviderKey[];
  const withCurrentLast = [...fallbackModels.filter((item) => item !== currentModel), currentModel];

  const suggestions: ProviderKey[] = [];
  for (const model of withCurrentLast) {
    if (model === currentModel) continue;
    const provider = providerFromModel(model);
    const health = await getHealth(provider);
    if (health.breakerState === CircuitBreakerState.OPEN) continue;
    suggestions.push(model);
  }
  return suggestions.slice(0, 3);
};

const checkProviderBeforeRequest = async (model: ProviderKey) => {
  if (!env.FEATURE_AI_RELIABILITY) return { blocked: false as const };
  const provider = providerFromModel(model);
  const health = await getHealth(provider);
  const now = new Date();

  if (health.breakerState === CircuitBreakerState.OPEN) {
    if (health.openUntil && health.openUntil > now) {
      const suggestedModels = await getSuggestedFallbackModels(model);
      return {
        blocked: true as const,
        reason: "OPEN",
        provider,
        suggestedModels,
      };
    }
    await (prisma as any).aiProviderHealth.update({
      where: { provider },
      data: {
        breakerState: CircuitBreakerState.HALF_OPEN,
        status: ProviderHealthStatus.DEGRADED,
        halfOpenTrialCount: 0,
        halfOpenSuccessCount: 0,
      },
    });
  }

  const latest = await getHealth(provider);
  if (latest.breakerState === CircuitBreakerState.HALF_OPEN) {
    if (latest.halfOpenTrialCount >= env.AI_CB_HALF_OPEN_TRIALS) {
      const suggestedModels = await getSuggestedFallbackModels(model);
      return {
        blocked: true as const,
        reason: "HALF_OPEN_LIMIT",
        provider,
        suggestedModels,
      };
    }
    await (prisma as any).aiProviderHealth.update({
      where: { provider },
      data: {
        halfOpenTrialCount: latest.halfOpenTrialCount + 1,
      },
    });
  }

  return { blocked: false as const };
};

const recordRequestSuccess = async (model: ProviderKey, latencyMs: number) => {
  if (!env.FEATURE_AI_RELIABILITY) return;
  await updateHealthAfterOutcome({
    provider: providerFromModel(model),
    success: true,
    latencyMs,
  });
};

const recordRequestFailure = async (model: ProviderKey, latencyMs: number, error: unknown) => {
  if (!env.FEATURE_AI_RELIABILITY) return;
  await updateHealthAfterOutcome({
    provider: providerFromModel(model),
    success: false,
    latencyMs,
    errorType: classifyError(error),
  });
};

const runProviderProbe = async (model: ProviderKey) => {
  const started = Date.now();
  try {
    await aiService.createChatCompletion({
      model,
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 5,
      temperature: 0,
    });
    await recordRequestSuccess(model, Date.now() - started);
  } catch (error) {
    await recordRequestFailure(model, Date.now() - started, error);
  }
};

let probeTimer: NodeJS.Timeout | null = null;
const startProviderProbes = () => {
  if (probeTimer || !env.FEATURE_AI_RELIABILITY) return;
  probeTimer = setInterval(() => {
    for (const model of allModels) {
      if (!aiService.listEnabledModels().includes(model as ChatModel)) continue;
      void runProviderProbe(model);
    }
  }, Math.max(5000, env.AI_PROVIDER_PROBE_INTERVAL_MS));
};

const resolveFallbackModel = async (selected: ProviderKey) => {
  const mode = env.AI_FALLBACK_MODE;
  const suggestions = await getSuggestedFallbackModels(selected);
  if (mode === "AUTO" && suggestions.length > 0) {
    return {
      mode: "AUTO" as const,
      fallbackModel: suggestions[0],
      suggestions,
    };
  }
  return {
    mode: "SUGGEST" as const,
    fallbackModel: null,
    suggestions,
  };
};

export const reliabilityService = {
  getAllProviderHealth,
  checkProviderBeforeRequest,
  recordRequestSuccess,
  recordRequestFailure,
  resolveFallbackModel,
  startProviderProbes,
};
