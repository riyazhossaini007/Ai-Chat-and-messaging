"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.observabilityService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
const alertDelivery_service_1 = require("./alertDelivery.service");
const toKey = (provider, model) => `${provider}::${model}`;
const percentile = (values, p) => {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[index];
};
const dayStartUtc = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
const ensurePricingBootstrap = async () => {
    const count = await prisma_1.prisma.providerPricing.count();
    if (count > 0)
        return;
    const now = new Date();
    const seeds = [
        {
            provider: "openai",
            model: "openai",
            inputUsdPer1M: env_1.env.AI_PROMPT_COST_USD_PER_1K * 1000,
            outputUsdPer1M: env_1.env.AI_COMPLETION_COST_USD_PER_1K * 1000,
            effectiveFrom: now,
            pricingVersion: 1,
        },
        {
            provider: "anthropic",
            model: "claude",
            inputUsdPer1M: env_1.env.AI_PROMPT_COST_USD_PER_1K * 1000,
            outputUsdPer1M: env_1.env.AI_COMPLETION_COST_USD_PER_1K * 1000,
            effectiveFrom: now,
            pricingVersion: 1,
        },
        {
            provider: "gemini",
            model: "gemini",
            inputUsdPer1M: env_1.env.AI_PROMPT_COST_USD_PER_1K * 1000,
            outputUsdPer1M: env_1.env.AI_COMPLETION_COST_USD_PER_1K * 1000,
            effectiveFrom: now,
            pricingVersion: 1,
        },
        {
            provider: "xai",
            model: "grok",
            inputUsdPer1M: env_1.env.AI_PROMPT_COST_USD_PER_1K * 1000,
            outputUsdPer1M: env_1.env.AI_COMPLETION_COST_USD_PER_1K * 1000,
            effectiveFrom: now,
            pricingVersion: 1,
        },
    ];
    await prisma_1.prisma.providerPricing.createMany({ data: seeds });
};
const upsertAlert = async (input) => {
    const existing = await prisma_1.prisma.opsAlert.findUnique({
        where: { dedupeKey: input.dedupeKey },
    });
    if (existing && existing.status !== "RESOLVED") {
        return existing;
    }
    const alert = await prisma_1.prisma.opsAlert.upsert({
        where: { dedupeKey: input.dedupeKey },
        create: {
            type: input.type,
            severity: input.severity,
            dedupeKey: input.dedupeKey,
            message: input.message,
            provider: input.provider,
            model: input.model,
            details: input.details ?? {},
        },
        update: {
            type: input.type,
            severity: input.severity,
            status: "OPEN",
            message: input.message,
            provider: input.provider,
            model: input.model,
            details: input.details ?? {},
            triggeredAt: new Date(),
            resolvedAt: null,
            acknowledgedAt: null,
        },
    });
    if (env_1.env.OBS_ALERT_WEBHOOK_URL) {
        // compatibility path: OBS_ALERT_WEBHOOK_URL kept as legacy Slack webhook
    }
    await alertDelivery_service_1.alertDeliveryService
        .deliverAlert({
        type: String(alert.type),
        severity: String(alert.severity),
        message: String(alert.message),
        provider: alert.provider ?? null,
        model: alert.model ?? null,
        details: alert.details ?? {},
        triggeredAt: alert.triggeredAt,
    })
        .catch(() => undefined);
    return alert;
};
const getLiveMetrics = async (input) => {
    const hours = Math.max(1, Math.min(168, input?.hours ?? 1));
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const logs = await prisma_1.prisma.aiRequestLog.findMany({
        where: { startedAt: { gte: since } },
        select: {
            provider: true,
            model: true,
            status: true,
            latencyMs: true,
            ttftMs: true,
            streamDurationMs: true,
            retryCount: true,
            promptTokens: true,
            completionTokens: true,
            totalTokens: true,
            costUsd: true,
            estimatorUsed: true,
            isRegeneration: true,
        },
    });
    const paywallBlocks = await prisma_1.prisma.securityEvent.count({
        where: {
            type: "PAYWALL_BLOCK",
            createdAt: { gte: since },
        },
    });
    const providerHealth = await prisma_1.prisma.aiProviderHealth.findMany();
    const grouped = new Map();
    for (const row of logs) {
        const key = toKey(row.provider, row.model);
        const bucket = grouped.get(key) ??
            {
                provider: row.provider,
                model: row.model,
                requests: 0,
                ok: 0,
                error: 0,
                cancelled: 0,
                retries: 0,
                regenCount: 0,
                estimatorCount: 0,
                tokensPrompt: 0,
                tokensCompletion: 0,
                tokensTotal: 0,
                costUsd: 0,
                latencies: [],
                ttfts: [],
                streamDurations: [],
            };
        bucket.requests += 1;
        if (row.status === "OK")
            bucket.ok += 1;
        if (row.status === "ERROR")
            bucket.error += 1;
        if (row.status === "CANCELLED")
            bucket.cancelled += 1;
        bucket.retries += row.retryCount ?? 0;
        bucket.regenCount += row.isRegeneration ? 1 : 0;
        bucket.estimatorCount += row.estimatorUsed ? 1 : 0;
        bucket.tokensPrompt += row.promptTokens;
        bucket.tokensCompletion += row.completionTokens;
        bucket.tokensTotal += row.totalTokens;
        bucket.costUsd += row.costUsd;
        if (typeof row.latencyMs === "number")
            bucket.latencies.push(row.latencyMs);
        if (typeof row.ttftMs === "number")
            bucket.ttfts.push(row.ttftMs);
        if (typeof row.streamDurationMs === "number")
            bucket.streamDurations.push(row.streamDurationMs);
        grouped.set(key, bucket);
    }
    const metrics = Array.from(grouped.values()).map((bucket) => ({
        provider: bucket.provider,
        model: bucket.model,
        ai_requests_total: bucket.requests,
        ai_request_status: { ok: bucket.ok, error: bucket.error, cancelled: bucket.cancelled },
        ai_request_latency_ms: {
            p50: percentile(bucket.latencies, 50),
            p95: percentile(bucket.latencies, 95),
            p99: percentile(bucket.latencies, 99),
        },
        ai_ttft_ms: {
            p50: percentile(bucket.ttfts, 50),
            p95: percentile(bucket.ttfts, 95),
            p99: percentile(bucket.ttfts, 99),
        },
        ai_stream_duration_ms: {
            p50: percentile(bucket.streamDurations, 50),
            p95: percentile(bucket.streamDurations, 95),
            p99: percentile(bucket.streamDurations, 99),
        },
        ai_retries_total: bucket.retries,
        ai_tokens_total: {
            prompt: bucket.tokensPrompt,
            completion: bucket.tokensCompletion,
            total: bucket.tokensTotal,
        },
        ai_cost_usd_total: Number(bucket.costUsd.toFixed(6)),
        ai_regen_total: bucket.regenCount,
        estimator_rate: bucket.requests > 0 ? bucket.estimatorCount / bucket.requests : 0,
    }));
    return {
        windowHours: hours,
        paywallBlocks,
        providerHealth,
        metrics,
    };
};
const runDailyRollup = async (input) => {
    await ensurePricingBootstrap();
    const date = dayStartUtc(input?.date ?? new Date(Date.now() - 24 * 60 * 60 * 1000));
    const start = date;
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const logs = await prisma_1.prisma.aiRequestLog.findMany({
        where: { startedAt: { gte: start, lt: end } },
        select: {
            provider: true,
            model: true,
            status: true,
            promptTokens: true,
            completionTokens: true,
            totalTokens: true,
            costUsd: true,
            latencyMs: true,
            isRegeneration: true,
        },
    });
    const ledger = await prisma_1.prisma.creditLedger.findMany({
        where: {
            createdAt: { gte: start, lt: end },
            type: { in: [client_1.CreditLedgerType.DEBIT, client_1.CreditLedgerType.AI_USAGE, client_1.CreditLedgerType.REFUND] },
        },
        select: {
            provider: true,
            model: true,
            type: true,
            deltaCredits: true,
            creditsAmount: true,
        },
    });
    const paywallBlocks = await prisma_1.prisma.securityEvent.count({
        where: { type: "PAYWALL_BLOCK", createdAt: { gte: start, lt: end } },
    });
    const buckets = new Map();
    const getBucket = (provider, model) => {
        const key = toKey(provider, model);
        const existing = buckets.get(key);
        if (existing)
            return existing;
        const created = {
            provider,
            model,
            requests: 0,
            errors: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            costUsd: 0,
            creditsCharged: 0,
            refunds: 0,
            regenCount: 0,
            latencies: [],
        };
        buckets.set(key, created);
        return created;
    };
    for (const row of logs) {
        const bucket = getBucket(row.provider, row.model);
        bucket.requests += 1;
        bucket.errors += row.status === "ERROR" ? 1 : 0;
        bucket.promptTokens += row.promptTokens;
        bucket.completionTokens += row.completionTokens;
        bucket.totalTokens += row.totalTokens;
        bucket.costUsd += row.costUsd;
        bucket.regenCount += row.isRegeneration ? 1 : 0;
        if (typeof row.latencyMs === "number")
            bucket.latencies.push(row.latencyMs);
    }
    for (const row of ledger) {
        const provider = row.provider ?? "unknown";
        const model = row.model ?? "unknown";
        const bucket = getBucket(provider, model);
        if (row.type === client_1.CreditLedgerType.REFUND) {
            bucket.refunds += Math.abs(row.creditsAmount ?? row.deltaCredits ?? 0);
            continue;
        }
        bucket.creditsCharged += Math.abs(row.creditsAmount ?? row.deltaCredits ?? 0);
    }
    for (const bucket of buckets.values()) {
        const revenueUsd = bucket.creditsCharged / Math.max(1, env_1.env.AI_CREDITS_PER_USD);
        const marginUsd = revenueUsd - bucket.costUsd;
        const marginPct = revenueUsd > 0 ? marginUsd / revenueUsd : 0;
        await prisma_1.prisma.dailyAiCost.upsert({
            where: {
                date_provider_model: {
                    date: start,
                    provider: bucket.provider,
                    model: bucket.model,
                },
            },
            create: {
                date: start,
                provider: bucket.provider,
                model: bucket.model,
                requests: bucket.requests,
                promptTokens: bucket.promptTokens,
                completionTokens: bucket.completionTokens,
                totalTokens: bucket.totalTokens,
                costUsd: Number(bucket.costUsd.toFixed(6)),
                creditsCharged: bucket.creditsCharged,
                refunds: bucket.refunds,
                paywallBlocks: paywallBlocks,
                regenCount: bucket.regenCount,
                avgLatencyMs: bucket.latencies.length > 0
                    ? bucket.latencies.reduce((sum, value) => sum + value, 0) / bucket.latencies.length
                    : 0,
                p95LatencyMs: percentile(bucket.latencies, 95),
                errorRate: bucket.requests > 0 ? bucket.errors / bucket.requests : 0,
                revenueUsd: Number(revenueUsd.toFixed(6)),
                marginUsd: Number(marginUsd.toFixed(6)),
                marginPct: Number(marginPct.toFixed(6)),
            },
            update: {
                requests: bucket.requests,
                promptTokens: bucket.promptTokens,
                completionTokens: bucket.completionTokens,
                totalTokens: bucket.totalTokens,
                costUsd: Number(bucket.costUsd.toFixed(6)),
                creditsCharged: bucket.creditsCharged,
                refunds: bucket.refunds,
                paywallBlocks: paywallBlocks,
                regenCount: bucket.regenCount,
                avgLatencyMs: bucket.latencies.length > 0
                    ? bucket.latencies.reduce((sum, value) => sum + value, 0) / bucket.latencies.length
                    : 0,
                p95LatencyMs: percentile(bucket.latencies, 95),
                errorRate: bucket.requests > 0 ? bucket.errors / bucket.requests : 0,
                revenueUsd: Number(revenueUsd.toFixed(6)),
                marginUsd: Number(marginUsd.toFixed(6)),
                marginPct: Number(marginPct.toFixed(6)),
            },
        });
    }
    return { date: start.toISOString(), groups: buckets.size };
};
const getDailyDashboard = async (input) => {
    const days = Math.max(1, Math.min(90, input?.days ?? 30));
    const start = dayStartUtc(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
    const rows = await prisma_1.prisma.dailyAiCost.findMany({
        where: { date: { gte: start } },
        orderBy: [{ date: "asc" }, { provider: "asc" }, { model: "asc" }],
    });
    return { days, from: start.toISOString(), rows };
};
const evaluateAlerts = async () => {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const tenMinAgo = new Date(now - 10 * 60 * 1000);
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const [hourLogs, dayLogs, healthRows, anomalousCharged, hourRefunds, hourLedger, dlqCount] = await Promise.all([
        prisma_1.prisma.aiRequestLog.findMany({
            where: { startedAt: { gte: oneHourAgo } },
            select: {
                provider: true,
                model: true,
                status: true,
                costUsd: true,
                estimatorUsed: true,
                latencyMs: true,
            },
        }),
        prisma_1.prisma.aiRequestLog.findMany({
            where: { startedAt: { gte: dayAgo } },
            select: { costUsd: true, startedAt: true },
        }),
        prisma_1.prisma.aiProviderHealth.findMany(),
        prisma_1.prisma.aiRequestLog.count({
            where: {
                charged: true,
                status: { not: "OK" },
            },
        }),
        prisma_1.prisma.creditLedger.aggregate({
            where: {
                createdAt: { gte: oneHourAgo },
                type: client_1.CreditLedgerType.REFUND,
            },
            _count: { _all: true },
        }),
        prisma_1.prisma.creditLedger.aggregate({
            where: {
                createdAt: { gte: oneHourAgo },
                type: { in: [client_1.CreditLedgerType.DEBIT, client_1.CreditLedgerType.AI_USAGE] },
            },
            _count: { _all: true },
        }),
        prisma_1.prisma.backgroundJob.count({
            where: {
                status: "DLQ",
            },
        }),
    ]);
    const totalSpendHour = hourLogs.reduce((sum, row) => sum + row.costUsd, 0);
    const baselineSpend = dayLogs.length > 0 ? dayLogs.reduce((sum, row) => sum + row.costUsd, 0) / 24 : 0;
    if (totalSpendHour > env_1.env.OBS_SPEND_HOURLY_USD_THRESHOLD ||
        (baselineSpend > 0 && totalSpendHour > baselineSpend * env_1.env.OBS_SPEND_SPIKE_MULTIPLIER)) {
        await upsertAlert({
            type: "SPEND_SPIKE",
            severity: "HIGH",
            dedupeKey: `spend-spike-${new Date().toISOString().slice(0, 13)}`,
            message: "Hourly spend spike detected",
            details: {
                totalSpendHour,
                baselineSpend,
                threshold: env_1.env.OBS_SPEND_HOURLY_USD_THRESHOLD,
            },
        });
    }
    const grouped = new Map();
    for (const row of hourLogs.filter((item) => item.status === "ERROR" || item.status === "OK")) {
        const key = toKey(row.provider, row.model);
        const bucket = grouped.get(key) ?? { total: 0, errors: 0, latencies: [] };
        bucket.total += 1;
        bucket.errors += row.status === "ERROR" ? 1 : 0;
        if (typeof row.latencyMs === "number")
            bucket.latencies.push(row.latencyMs);
        grouped.set(key, bucket);
    }
    for (const [key, bucket] of grouped) {
        const [provider, model] = key.split("::");
        const errorRate = bucket.total > 0 ? bucket.errors / bucket.total : 0;
        if (errorRate > env_1.env.OBS_ERROR_RATE_THRESHOLD) {
            await upsertAlert({
                type: "ERROR_SPIKE",
                severity: "HIGH",
                dedupeKey: `error-spike-${provider}-${model}-${new Date().toISOString().slice(0, 13)}`,
                message: `Error spike for ${provider}/${model}`,
                provider,
                model,
                details: { errorRate, total: bucket.total, window: "1h", since: tenMinAgo.toISOString() },
            });
        }
        const p95 = percentile(bucket.latencies, 95);
        if (p95 > env_1.env.OBS_PROVIDER_P95_MS_THRESHOLD) {
            await upsertAlert({
                type: "ERROR_SPIKE",
                severity: "MEDIUM",
                dedupeKey: `latency-spike-${provider}-${model}-${new Date().toISOString().slice(0, 13)}`,
                message: `Latency spike for ${provider}/${model}`,
                provider,
                model,
                details: { p95, threshold: env_1.env.OBS_PROVIDER_P95_MS_THRESHOLD, window: "1h" },
            });
        }
    }
    for (const row of healthRows) {
        if (row.status === "DOWN" || row.breakerState === "OPEN") {
            await upsertAlert({
                type: "PROVIDER_DOWNTIME",
                severity: "CRITICAL",
                dedupeKey: `provider-down-${row.provider}-${new Date().toISOString().slice(0, 13)}`,
                message: `Provider ${row.provider} is down/degraded`,
                provider: row.provider,
                details: {
                    status: row.status,
                    breakerState: row.breakerState,
                    errorRate: row.errorRate,
                    timeoutRate: row.timeoutRate,
                },
            });
        }
    }
    if (anomalousCharged > 0) {
        await upsertAlert({
            type: "BILLING_ANOMALY",
            severity: "CRITICAL",
            dedupeKey: `billing-anomaly-charged-not-ok-${new Date().toISOString().slice(0, 13)}`,
            message: "Charged requests found without OK status",
            details: { count: anomalousCharged },
        });
    }
    const estimatorRate = hourLogs.length > 0 ? hourLogs.filter((row) => row.estimatorUsed).length / hourLogs.length : 0;
    if (estimatorRate > env_1.env.OBS_ESTIMATOR_RATE_THRESHOLD) {
        await upsertAlert({
            type: "ESTIMATOR_SPIKE",
            severity: "MEDIUM",
            dedupeKey: `estimator-spike-${new Date().toISOString().slice(0, 13)}`,
            message: "Estimator usage spike detected",
            details: { estimatorRate, threshold: env_1.env.OBS_ESTIMATOR_RATE_THRESHOLD },
        });
    }
    const refundRate = (hourLedger._count._all ?? 0) > 0
        ? (hourRefunds._count._all ?? 0) / (hourLedger._count._all ?? 1)
        : 0;
    if (refundRate > env_1.env.OBS_REFUND_RATE_THRESHOLD) {
        await upsertAlert({
            type: "BILLING_ANOMALY",
            severity: "HIGH",
            dedupeKey: `refund-rate-spike-${new Date().toISOString().slice(0, 13)}`,
            message: "Refund rate spike detected",
            details: { refundRate, threshold: env_1.env.OBS_REFUND_RATE_THRESHOLD },
        });
    }
    if (dlqCount > env_1.env.OBS_DLQ_ALERT_THRESHOLD) {
        await upsertAlert({
            type: "DLQ_GROWTH",
            severity: "HIGH",
            dedupeKey: `dlq-growth-${new Date().toISOString().slice(0, 13)}`,
            message: "DLQ job count exceeded threshold",
            details: { dlqCount, threshold: env_1.env.OBS_DLQ_ALERT_THRESHOLD },
        });
    }
    return {
        evaluatedAt: new Date().toISOString(),
        totalSpendHour,
        baselineSpend,
        estimatorRate,
        refundRate,
        dlqCount,
    };
};
const triggerAlert = async (input) => {
    return upsertAlert({
        type: input.type,
        severity: input.severity,
        dedupeKey: `manual-${input.type}-${Date.now()}`,
        message: input.message,
        provider: input.provider,
        model: input.model,
        details: input.details ?? {},
    });
};
const listAlerts = async (input) => {
    return prisma_1.prisma.opsAlert.findMany({
        where: input?.status ? { status: input.status } : undefined,
        orderBy: { triggeredAt: "desc" },
        take: Math.max(1, Math.min(500, input?.limit ?? 100)),
    });
};
const acknowledgeAlert = async (id) => {
    return prisma_1.prisma.opsAlert.update({
        where: { id },
        data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() },
    });
};
const resolveAlert = async (id) => {
    return prisma_1.prisma.opsAlert.update({
        where: { id },
        data: { status: "RESOLVED", resolvedAt: new Date() },
    });
};
let alertTimer = null;
let rollupTimer = null;
const startOpsWorkers = () => {
    if (!alertTimer) {
        alertTimer = setInterval(() => {
            void evaluateAlerts().catch(() => undefined);
        }, Math.max(10000, env_1.env.OBS_ALERT_EVAL_INTERVAL_MS));
    }
    if (!rollupTimer) {
        rollupTimer = setInterval(() => {
            void runDailyRollup().catch(() => undefined);
        }, Math.max(60000, env_1.env.OBS_DAILY_ROLLUP_INTERVAL_MS));
    }
};
exports.observabilityService = {
    ensurePricingBootstrap,
    getLiveMetrics,
    runDailyRollup,
    getDailyDashboard,
    evaluateAlerts,
    listAlerts,
    acknowledgeAlert,
    resolveAlert,
    triggerAlert,
    startOpsWorkers,
};
