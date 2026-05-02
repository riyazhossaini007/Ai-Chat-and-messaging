"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reliabilityService = void 0;
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
const ai_service_1 = require("./ai.service");
const security_service_1 = require("../security/security.service");
const providerFromModel = (model) => {
    if (model === "openrouter")
        return "openrouter";
    if (model === "openai")
        return "openai";
    if (model === "claude")
        return "anthropic";
    if (model === "gemini")
        return "gemini";
    return "xai";
};
const CircuitBreakerState = {
    CLOSED: "CLOSED",
    OPEN: "OPEN",
    HALF_OPEN: "HALF_OPEN",
};
const ProviderHealthStatus = {
    HEALTHY: "HEALTHY",
    DEGRADED: "DEGRADED",
    DOWN: "DOWN",
};
const allModels = ["openrouter", "openai", "claude", "gemini", "grok"];
const inMemory = new Map();
const percentile = (values, p) => {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[index];
};
async function getOrCreateHealth(provider) {
    return prisma_1.prisma.aiProviderHealth.upsert({
        where: { provider },
        create: { provider },
        update: {},
    });
}
const classifyError = (error) => {
    if (!(error instanceof Error))
        return "unknown";
    if (/timeout|timed out|abort/i.test(error.message))
        return "timeout";
    if (/401|403|auth|unauthorized|forbidden/i.test(error.message))
        return "auth";
    if (/quota|rate limit|429/i.test(error.message))
        return "quota";
    if (/5\d\d/.test(error.message))
        return "5xx";
    if (/4\d\d/.test(error.message))
        return "4xx";
    return "unknown";
};
const shouldOpenCircuit = (health) => {
    return (health.errorRate > env_1.env.AI_CB_ERROR_RATE_THRESHOLD ||
        health.timeoutRate > env_1.env.AI_CB_TIMEOUT_RATE_THRESHOLD ||
        health.consecutiveFailures >= env_1.env.AI_CB_CONSEC_FAIL_THRESHOLD ||
        (health.rollingLatencyP95Ms ?? 0) > env_1.env.AI_CB_P95_LATENCY_THRESHOLD_MS);
};
const computeStatus = (health) => {
    if (health.breakerState === CircuitBreakerState.OPEN)
        return ProviderHealthStatus.DOWN;
    if (health.errorRate > env_1.env.AI_CB_ERROR_RATE_THRESHOLD / 2 ||
        health.timeoutRate > env_1.env.AI_CB_TIMEOUT_RATE_THRESHOLD / 2 ||
        (health.rollingLatencyP95Ms ?? 0) > env_1.env.AI_CB_P95_LATENCY_THRESHOLD_MS * 0.7) {
        return ProviderHealthStatus.DEGRADED;
    }
    return ProviderHealthStatus.HEALTHY;
};
const parseSamples = (value) => {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => typeof item === "number");
};
const updateHealthAfterOutcome = async (input) => {
    const now = new Date();
    const current = await getOrCreateHealth(input.provider);
    const windowAgeMs = now.getTime() - current.windowStartedAt.getTime();
    const resetWindow = windowAgeMs > 5 * 60000;
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
            if (halfOpenSuccessCount >= env_1.env.AI_CB_HALF_OPEN_TRIALS) {
                breakerState = CircuitBreakerState.CLOSED;
                halfOpenTrialCount = 0;
                halfOpenSuccessCount = 0;
                openUntil = null;
            }
        }
        else {
            breakerState = CircuitBreakerState.OPEN;
            openUntil = new Date(now.getTime() + env_1.env.AI_CB_OPEN_DURATION_MS);
            halfOpenTrialCount = 0;
            halfOpenSuccessCount = 0;
        }
    }
    else if (breakerState === CircuitBreakerState.CLOSED) {
        const simulated = {
            ...current,
            errorRate: nextReqCount > 0 ? nextErrCount / nextReqCount : 0,
            timeoutRate: nextReqCount > 0 ? nextTimeoutCount / nextReqCount : 0,
            consecutiveFailures: input.success ? 0 : current.consecutiveFailures + 1,
            rollingLatencyP95Ms: p95,
        };
        if (shouldOpenCircuit(simulated)) {
            breakerState = CircuitBreakerState.OPEN;
            openUntil = new Date(now.getTime() + env_1.env.AI_CB_OPEN_DURATION_MS);
            halfOpenTrialCount = 0;
            halfOpenSuccessCount = 0;
            console.warn(JSON.stringify({
                event: "ai.circuit.open",
                provider: input.provider,
                errorRate: simulated.errorRate,
                timeoutRate: simulated.timeoutRate,
                p95LatencyMs: simulated.rollingLatencyP95Ms,
                consecutiveFailures: simulated.consecutiveFailures,
                at: now.toISOString(),
            }));
            void security_service_1.securityService.logSecurityEvent({
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
    const updated = await prisma_1.prisma.aiProviderHealth.update({
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
            latencySamples: nextSamples,
            openUntil,
            halfOpenTrialCount,
            halfOpenSuccessCount,
        },
    });
    inMemory.set(input.provider, { updatedAt: Date.now(), data: updated });
    return updated;
};
const getHealth = async (provider) => {
    const cached = inMemory.get(provider);
    if (cached && Date.now() - cached.updatedAt < 5000)
        return cached.data;
    const health = await getOrCreateHealth(provider);
    inMemory.set(provider, { updatedAt: Date.now(), data: health });
    return health;
};
const getAllProviderHealth = async () => {
    const items = await Promise.all(["openrouter", "openai", "anthropic", "gemini", "xai"].map(async (provider) => {
        const health = await getHealth(provider);
        return { provider, ...health };
    }));
    for (const item of items) {
        if (item.status === ProviderHealthStatus.DOWN) {
            void security_service_1.securityService.logSecurityEvent({
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
const getSuggestedFallbackModels = async (currentModel) => {
    const enabled = ai_service_1.aiService.listEnabledModels();
    const order = env_1.env.AI_FALLBACK_ORDER.split(",").map((item) => item.trim().toLowerCase());
    const fallbackModels = order.filter((model) => enabled.includes(model));
    const withCurrentLast = [...fallbackModels.filter((item) => item !== currentModel), currentModel];
    const suggestions = [];
    for (const model of withCurrentLast) {
        if (model === currentModel)
            continue;
        const provider = providerFromModel(model);
        const health = await getHealth(provider);
        if (health.breakerState === CircuitBreakerState.OPEN)
            continue;
        suggestions.push(model);
    }
    return suggestions.slice(0, 3);
};
const checkProviderBeforeRequest = async (model) => {
    if (!env_1.env.FEATURE_AI_RELIABILITY)
        return { blocked: false };
    const provider = providerFromModel(model);
    const health = await getHealth(provider);
    const now = new Date();
    if (health.breakerState === CircuitBreakerState.OPEN) {
        if (health.openUntil && health.openUntil > now) {
            const suggestedModels = await getSuggestedFallbackModels(model);
            return {
                blocked: true,
                reason: "OPEN",
                provider,
                suggestedModels,
            };
        }
        await prisma_1.prisma.aiProviderHealth.update({
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
        if (latest.halfOpenTrialCount >= env_1.env.AI_CB_HALF_OPEN_TRIALS) {
            const suggestedModels = await getSuggestedFallbackModels(model);
            return {
                blocked: true,
                reason: "HALF_OPEN_LIMIT",
                provider,
                suggestedModels,
            };
        }
        await prisma_1.prisma.aiProviderHealth.update({
            where: { provider },
            data: {
                halfOpenTrialCount: latest.halfOpenTrialCount + 1,
            },
        });
    }
    return { blocked: false };
};
const recordRequestSuccess = async (model, latencyMs) => {
    if (!env_1.env.FEATURE_AI_RELIABILITY)
        return;
    await updateHealthAfterOutcome({
        provider: providerFromModel(model),
        success: true,
        latencyMs,
    });
};
const recordRequestFailure = async (model, latencyMs, error) => {
    if (!env_1.env.FEATURE_AI_RELIABILITY)
        return;
    await updateHealthAfterOutcome({
        provider: providerFromModel(model),
        success: false,
        latencyMs,
        errorType: classifyError(error),
    });
};
const runProviderProbe = async (model) => {
    const started = Date.now();
    try {
        await ai_service_1.aiService.createChatCompletion({
            model,
            messages: [{ role: "user", content: "ping" }],
            maxTokens: 5,
            temperature: 0,
        });
        await recordRequestSuccess(model, Date.now() - started);
    }
    catch (error) {
        await recordRequestFailure(model, Date.now() - started, error);
    }
};
let probeTimer = null;
const startProviderProbes = () => {
    if (probeTimer || !env_1.env.FEATURE_AI_RELIABILITY)
        return;
    probeTimer = setInterval(() => {
        for (const model of allModels) {
            if (!ai_service_1.aiService.listEnabledModels().includes(model))
                continue;
            void runProviderProbe(model);
        }
    }, Math.max(5000, env_1.env.AI_PROVIDER_PROBE_INTERVAL_MS));
};
const resolveFallbackModel = async (selected) => {
    const mode = env_1.env.AI_FALLBACK_MODE;
    const suggestions = await getSuggestedFallbackModels(selected);
    if (mode === "AUTO" && suggestions.length > 0) {
        return {
            mode: "AUTO",
            fallbackModel: suggestions[0],
            suggestions,
        };
    }
    return {
        mode: "SUGGEST",
        fallbackModel: null,
        suggestions,
    };
};
exports.reliabilityService = {
    getAllProviderHealth,
    checkProviderBeforeRequest,
    recordRequestSuccess,
    recordRequestFailure,
    resolveFallbackModel,
    startProviderProbes,
};
