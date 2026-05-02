"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creditsService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
const errorHandler_1 = require("../../middlewares/errorHandler");
const ai_service_1 = require("../ai/ai.service");
const featureGate_service_1 = require("../admin/featureGate.service");
const security_service_1 = require("../security/security.service");
const trace_service_1 = require("../observability/trace.service");
const toCredits = (input) => {
    const tokenUnits = input.totalTokens / 1000;
    const multiplier = ai_service_1.aiService.getModelMultiplier(input.model);
    const value = Math.ceil(tokenUnits * env_1.env.AI_CREDITS_PER_1K_TOKENS * multiplier);
    return Math.max(0, value);
};
const resolveLoggedModel = (value) => {
    const normalized = value.trim().toLowerCase();
    if (normalized === "openrouter")
        return "openrouter";
    if (normalized === "openai")
        return "openai";
    if (normalized === "claude")
        return "claude";
    if (normalized === "gemini")
        return "gemini";
    if (normalized === "grok")
        return "grok";
    return "openai";
};
const getActiveSubscription = async (userId) => {
    const now = new Date();
    await prisma_1.prisma.subscription.updateMany({
        where: {
            userId,
            status: client_1.SubscriptionStatus.ACTIVE,
            currentPeriodEnd: { lte: now },
        },
        data: {
            status: client_1.SubscriptionStatus.EXPIRED,
        },
    });
    const active = await prisma_1.prisma.subscription.findFirst({
        where: {
            userId,
            status: client_1.SubscriptionStatus.ACTIVE,
            currentPeriodEnd: {
                gt: now,
            },
        },
        orderBy: {
            currentPeriodEnd: "desc",
        },
        include: {
            plan: true,
        },
    });
    return active;
};
const hasActiveSubscription = async (userId) => {
    const active = await getActiveSubscription(userId);
    if (active)
        return true;
    const [proAccess, aiUnlimited] = await Promise.all([
        featureGate_service_1.featureGateService.hasActiveEntitlement(userId, "PRO_ACCESS"),
        featureGate_service_1.featureGateService.hasActiveEntitlement(userId, "AI_UNLIMITED"),
    ]);
    return proAccess || aiUnlimited;
};
const getWalletSummary = async (userId) => {
    const wallet = await prisma_1.prisma.userCreditWallet.upsert({
        where: { userId },
        create: { userId, balanceCredits: 0 },
        update: {},
        select: {
            balanceCredits: true,
        },
    });
    const usedAgg = await prisma_1.prisma.creditLedger.aggregate({
        where: {
            userId,
            type: {
                in: [client_1.CreditLedgerType.AI_USAGE, client_1.CreditLedgerType.DEBIT],
            },
        },
        _sum: {
            deltaCredits: true,
        },
    });
    const usedCredits = Math.abs(Math.min(usedAgg._sum.deltaCredits ?? 0, 0));
    const remainingCredits = wallet.balanceCredits;
    const totalCredits = remainingCredits + usedCredits;
    return {
        totalCredits,
        usedCredits,
        remainingCredits,
    };
};
const assertCanUseAi = async (userId) => {
    const creditSummary = await getWalletSummary(userId);
    const subscription = await getActiveSubscription(userId);
    const [proAccess, aiUnlimited] = await Promise.all([
        featureGate_service_1.featureGateService.hasActiveEntitlement(userId, "PRO_ACCESS"),
        featureGate_service_1.featureGateService.hasActiveEntitlement(userId, "AI_UNLIMITED"),
    ]);
    const complimentaryAiAccess = proAccess || aiUnlimited;
    if (subscription || complimentaryAiAccess) {
        return {
            subscriptionActive: true,
            complimentaryAiAccess,
            subscription,
            credits: creditSummary,
        };
    }
    if (creditSummary.remainingCredits <= 0) {
        throw new errorHandler_1.AppError(402, "Buy credits to use AI models", {
            error: "CREDITS_REQUIRED",
            code: "CREDITS_REQUIRED",
        });
    }
    return {
        subscriptionActive: false,
        complimentaryAiAccess: false,
        subscription: null,
        credits: creditSummary,
    };
};
const chargeForAiRequest = async (requestId) => {
    return prisma_1.prisma.$transaction(async (tx) => {
        const existing = await tx.creditLedger.findUnique({
            where: { requestId },
            select: { id: true },
        });
        if (existing) {
            return { charged: false, reason: "already_charged" };
        }
        const log = await tx.aiRequestLog.findUnique({
            where: { requestId },
            select: {
                id: true,
                requestId: true,
                userId: true,
                provider: true,
                model: true,
                status: true,
                charged: true,
                totalTokens: true,
                completionTokens: true,
            },
        });
        if (!log)
            return { charged: false, reason: "log_not_found" };
        if (log.status !== "OK")
            return { charged: false, reason: "not_ok" };
        if (log.charged)
            return { charged: false, reason: "already_charged_flag" };
        if (log.totalTokens <= 0 || log.completionTokens <= 0) {
            return { charged: false, reason: "no_completion_tokens" };
        }
        const [subscription, proAccess, aiUnlimited] = await Promise.all([
            getActiveSubscription(log.userId),
            featureGate_service_1.featureGateService.hasActiveEntitlement(log.userId, "PRO_ACCESS"),
            featureGate_service_1.featureGateService.hasActiveEntitlement(log.userId, "AI_UNLIMITED"),
        ]);
        if (subscription || proAccess || aiUnlimited) {
            await tx.aiRequestLog.update({
                where: { requestId: log.requestId },
                data: {
                    costCredits: 0,
                    charged: false,
                },
            });
            return {
                charged: false,
                reason: subscription ? "subscription_active" : "complimentary_access",
            };
        }
        const normalizedModel = resolveLoggedModel(log.model);
        const costCredits = toCredits({
            totalTokens: log.totalTokens,
            model: normalizedModel,
        });
        if (costCredits <= 0)
            return { charged: false, reason: "zero_cost" };
        const wallet = await tx.userCreditWallet.upsert({
            where: { userId: log.userId },
            create: { userId: log.userId, balanceCredits: 0 },
            update: {},
        });
        const nextBalance = wallet.balanceCredits - costCredits;
        await tx.userCreditWallet.update({
            where: { id: wallet.id },
            data: { balanceCredits: nextBalance },
        });
        await tx.creditLedger.create({
            data: {
                userId: log.userId,
                walletId: wallet.id,
                requestId: log.requestId,
                aiRequestLogId: log.id,
                type: client_1.CreditLedgerType.DEBIT,
                tokens: log.totalTokens,
                creditsAmount: costCredits,
                provider: log.provider,
                model: log.model,
                deltaCredits: -costCredits,
                balanceAfter: nextBalance,
                note: "AI usage charge",
            },
        });
        await tx.aiRequestLog.update({
            where: { requestId: log.requestId },
            data: {
                costCredits,
                charged: true,
            },
        });
        if (costCredits >= env_1.env.AI_CREDIT_DRAIN_ALERT_THRESHOLD) {
            console.warn(`[ai-credit-alert] High credit drain`, JSON.stringify({
                requestId: log.requestId,
                userId: log.userId,
                model: normalizedModel,
                totalTokens: log.totalTokens,
                costCredits,
                balanceAfter: nextBalance,
            }));
            void security_service_1.securityService.logSecurityEvent({
                userId: log.userId,
                type: "BILLING_ANOMALY",
                requestId: log.requestId,
                details: {
                    reason: "high_credit_drain",
                    totalTokens: log.totalTokens,
                    costCredits,
                    balanceAfter: nextBalance,
                },
            });
        }
        if (nextBalance < -10000) {
            void security_service_1.securityService.logSecurityEvent({
                userId: log.userId,
                type: "BILLING_ANOMALY",
                requestId: log.requestId,
                details: {
                    reason: "extreme_negative_balance",
                    balanceAfter: nextBalance,
                },
            });
        }
        console.info(JSON.stringify({
            event: "ai.billing.charge",
            requestId: log.requestId,
            traceId: trace_service_1.traceService.getTraceContext()?.traceId ?? null,
            userId: log.userId,
            provider: log.provider,
            model: log.model,
            tokensTotal: log.totalTokens,
            credits: costCredits,
            charged: true,
        }));
        return {
            charged: true,
            credits: costCredits,
            balanceAfter: nextBalance,
        };
    }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable });
};
const refundAiRequest = async (requestId, note = "Manual refund") => {
    return prisma_1.prisma.$transaction(async (tx) => {
        const log = await tx.aiRequestLog.findUnique({
            where: { requestId },
            select: {
                id: true,
                requestId: true,
                userId: true,
                charged: true,
                costCredits: true,
                provider: true,
                model: true,
                totalTokens: true,
            },
        });
        if (!log)
            throw new errorHandler_1.AppError(404, "Request not found");
        if (!log.charged || log.costCredits <= 0) {
            throw new errorHandler_1.AppError(400, "Request has no charge to refund");
        }
        const existingRefund = await tx.creditLedger.findFirst({
            where: {
                requestId: `${log.requestId}:refund`,
                type: client_1.CreditLedgerType.REFUND,
            },
            select: { id: true },
        });
        if (existingRefund) {
            return { refunded: false, reason: "already_refunded" };
        }
        const wallet = await tx.userCreditWallet.upsert({
            where: { userId: log.userId },
            create: { userId: log.userId, balanceCredits: 0 },
            update: {},
        });
        const nextBalance = wallet.balanceCredits + log.costCredits;
        await tx.userCreditWallet.update({
            where: { id: wallet.id },
            data: { balanceCredits: nextBalance },
        });
        await tx.creditLedger.create({
            data: {
                userId: log.userId,
                walletId: wallet.id,
                requestId: `${log.requestId}:refund`,
                aiRequestLogId: log.id,
                type: client_1.CreditLedgerType.REFUND,
                tokens: log.totalTokens,
                creditsAmount: log.costCredits,
                provider: log.provider,
                model: log.model,
                deltaCredits: log.costCredits,
                balanceAfter: nextBalance,
                note,
            },
        });
        await tx.aiRequestLog.update({
            where: { requestId: log.requestId },
            data: { charged: false },
        });
        return { refunded: true, credits: log.costCredits, balanceAfter: nextBalance };
    }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable });
};
exports.creditsService = {
    chargeForAiRequest,
    refundAiRequest,
    getWalletSummary,
    assertCanUseAi,
    hasActiveSubscription,
    getActiveSubscription,
};
