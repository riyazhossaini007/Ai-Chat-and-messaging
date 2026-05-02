"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
const credits_service_1 = require("../credits/credits.service");
const getPlans = async () => {
    return prisma_1.prisma.plan.findMany({
        orderBy: { priceMonthly: "asc" },
    });
};
const createPlan = async (input) => {
    return prisma_1.prisma.plan.create({
        data: {
            name: input.name.trim(),
            priceMonthly: input.priceMonthly,
            creditAllowance: input.creditAllowance,
            modelAccess: input.modelAccess,
            maxTokensPerMonth: input.maxTokensPerMonth,
        },
    });
};
const upsertSubscription = async (input) => {
    const existing = await prisma_1.prisma.subscription.findFirst({
        where: {
            userId: input.userId,
            providerSubscriptionId: input.providerSubscriptionId ?? undefined,
        },
        orderBy: { updatedAt: "desc" },
    });
    if (existing) {
        return prisma_1.prisma.subscription.update({
            where: { id: existing.id },
            data: {
                planId: input.planId,
                status: input.status,
                billingProvider: input.billingProvider,
                providerCustomerId: input.providerCustomerId,
                providerSubscriptionId: input.providerSubscriptionId,
                currentPeriodStart: input.currentPeriodStart,
                currentPeriodEnd: input.currentPeriodEnd,
                cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
            },
        });
    }
    return prisma_1.prisma.subscription.create({
        data: {
            userId: input.userId,
            planId: input.planId,
            status: input.status,
            billingProvider: input.billingProvider,
            providerCustomerId: input.providerCustomerId,
            providerSubscriptionId: input.providerSubscriptionId,
            currentPeriodStart: input.currentPeriodStart,
            currentPeriodEnd: input.currentPeriodEnd,
            cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
        },
    });
};
const listAiRequestLogs = async (input) => {
    return prisma_1.prisma.aiRequestLog.findMany({
        where: input.userId ? { userId: input.userId } : undefined,
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(1, input.limit ?? 100), 500),
    });
};
const listLedger = async (input) => {
    return prisma_1.prisma.creditLedger.findMany({
        where: input.userId ? { userId: input.userId } : undefined,
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(1, input.limit ?? 100), 500),
    });
};
const issueRefund = async (input) => {
    const result = await credits_service_1.creditsService.refundAiRequest(input.requestId, input.note ? `Refund by ${input.actorUserId}: ${input.note}` : `Refund by ${input.actorUserId}`);
    console.info(JSON.stringify({
        event: "billing.refund.issued",
        actorUserId: input.actorUserId,
        requestId: input.requestId,
        result,
        at: new Date().toISOString(),
    }));
    return result;
};
const extractProviderTotalTokens = (provider, usageRaw) => {
    if (!usageRaw || typeof usageRaw !== "object")
        return null;
    const raw = usageRaw;
    if (provider === "openai" || provider === "xai") {
        const total = raw.total_tokens;
        return typeof total === "number" ? total : null;
    }
    if (provider === "anthropic") {
        const input = typeof raw.input_tokens === "number" ? raw.input_tokens : 0;
        const output = typeof raw.output_tokens === "number" ? raw.output_tokens : 0;
        const total = input + output;
        return total > 0 ? total : null;
    }
    if (provider === "gemini") {
        const total = raw.totalTokenCount;
        return typeof total === "number" ? total : null;
    }
    return null;
};
const reconcileUsageWindow = async (input) => {
    const logs = await prisma_1.prisma.aiRequestLog.findMany({
        where: {
            status: "OK",
            finishedAt: { gte: input.since },
        },
        orderBy: { finishedAt: "desc" },
        take: 5000,
    });
    let mismatches = 0;
    let adjusted = 0;
    for (const log of logs) {
        const providerTokens = extractProviderTotalTokens(log.provider, log.providerUsageRaw);
        const storedTokens = log.totalTokens;
        if (providerTokens === null)
            continue;
        const delta = providerTokens - storedTokens;
        const absDelta = Math.abs(delta);
        const status = absDelta > env_1.env.AI_RECONCILIATION_MISMATCH_THRESHOLD
            ? client_1.ReconciliationStatus.MISMATCH
            : client_1.ReconciliationStatus.OK;
        await prisma_1.prisma.usageReconciliation.create({
            data: {
                requestId: log.requestId,
                userId: log.userId,
                storedTokens,
                providerTokens,
                delta,
                status,
            },
        });
        if (status === client_1.ReconciliationStatus.MISMATCH)
            mismatches += 1;
        if (!input.applyAdjustments || status !== client_1.ReconciliationStatus.MISMATCH || !log.charged) {
            continue;
        }
        const alreadyAdjusted = await prisma_1.prisma.creditLedger.findFirst({
            where: { requestId: `${log.requestId}:recon` },
            select: { id: true },
        });
        if (alreadyAdjusted)
            continue;
        const wallet = await prisma_1.prisma.userCreditWallet.upsert({
            where: { userId: log.userId },
            create: { userId: log.userId, balanceCredits: 0 },
            update: {},
        });
        const tokenDeltaK = delta / 1000;
        const creditDelta = Math.ceil(Math.abs(tokenDeltaK) * env_1.env.AI_CREDITS_PER_1K_TOKENS);
        if (creditDelta <= 0)
            continue;
        const positive = delta < 0;
        const nextBalance = positive
            ? wallet.balanceCredits + creditDelta
            : wallet.balanceCredits - creditDelta;
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.userCreditWallet.update({
                where: { id: wallet.id },
                data: { balanceCredits: nextBalance },
            });
            await tx.creditLedger.create({
                data: {
                    userId: log.userId,
                    walletId: wallet.id,
                    requestId: `${log.requestId}:recon`,
                    aiRequestLogId: log.id,
                    type: positive ? client_1.CreditLedgerType.CREDIT : client_1.CreditLedgerType.DEBIT,
                    tokens: Math.abs(delta),
                    creditsAmount: creditDelta,
                    provider: log.provider,
                    model: log.model,
                    deltaCredits: positive ? creditDelta : -creditDelta,
                    balanceAfter: nextBalance,
                    note: "Reconciliation adjustment",
                },
            });
            await tx.usageReconciliation.create({
                data: {
                    requestId: log.requestId,
                    userId: log.userId,
                    storedTokens,
                    providerTokens,
                    delta,
                    status: client_1.ReconciliationStatus.ADJUSTED,
                },
            });
        });
        adjusted += 1;
    }
    return {
        scanned: logs.length,
        mismatches,
        adjusted,
    };
};
const ensureBootstrapPlans = async () => {
    const count = await prisma_1.prisma.plan.count();
    if (count === 0) {
        await prisma_1.prisma.plan.createMany({
            data: [
                {
                    name: "Starter",
                    priceMonthly: 9,
                    creditAllowance: 500,
                    modelAccess: { openai: true, claude: true, gemini: true, grok: false },
                    maxTokensPerMonth: 2000000,
                },
                {
                    name: "Pro",
                    priceMonthly: 29,
                    creditAllowance: 2500,
                    modelAccess: { openai: true, claude: true, gemini: true, grok: true },
                    maxTokensPerMonth: 10000000,
                },
            ],
        });
    }
    await prisma_1.prisma.systemConfig.upsert({
        where: { key: "MIGRATION_VERSION" },
        create: { key: "MIGRATION_VERSION", value: "20260216125000" },
        update: { value: "20260216125000" },
    });
};
exports.billingService = {
    getPlans,
    createPlan,
    upsertSubscription,
    listAiRequestLogs,
    listLedger,
    issueRefund,
    reconcileUsageWindow,
    ensureBootstrapPlans,
};
