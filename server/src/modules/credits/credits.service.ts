import { CreditLedgerType, Prisma, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../middlewares/errorHandler";
import { aiService, type ChatModel } from "../ai/ai.service";
import { featureGateService } from "../admin/featureGate.service";
import { securityService } from "../security/security.service";
import { traceService } from "../observability/trace.service";

const toCredits = (input: { totalTokens: number; model: ChatModel }) => {
  const tokenUnits = input.totalTokens / 1000;
  const multiplier = aiService.getModelMultiplier(input.model);
  const value = Math.ceil(tokenUnits * env.AI_CREDITS_PER_1K_TOKENS * multiplier);
  return Math.max(0, value);
};

const resolveLoggedModel = (value: string): ChatModel => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "openrouter") return "openrouter";
  if (normalized === "openai") return "openai";
  if (normalized === "claude") return "claude";
  if (normalized === "gemini") return "gemini";
  if (normalized === "grok") return "grok";
  return "openai";
};

const getActiveSubscription = async (userId: string) => {
  const now = new Date();
  await prisma.subscription.updateMany({
    where: {
      userId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: { lte: now },
    },
    data: {
      status: SubscriptionStatus.EXPIRED,
    },
  });
  const active = await prisma.subscription.findFirst({
    where: {
      userId,
      status: SubscriptionStatus.ACTIVE,
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

const hasActiveSubscription = async (userId: string) => {
  const active = await getActiveSubscription(userId);
  if (active) return true;
  const [proAccess, aiUnlimited] = await Promise.all([
    featureGateService.hasActiveEntitlement(userId, "PRO_ACCESS"),
    featureGateService.hasActiveEntitlement(userId, "AI_UNLIMITED"),
  ]);
  return proAccess || aiUnlimited;
};

const getWalletSummary = async (userId: string) => {
  const wallet = await prisma.userCreditWallet.upsert({
    where: { userId },
    create: { userId, balanceCredits: 0 },
    update: {},
    select: {
      balanceCredits: true,
    },
  });

  const usedAgg = await prisma.creditLedger.aggregate({
    where: {
      userId,
      type: {
        in: [CreditLedgerType.AI_USAGE, CreditLedgerType.DEBIT],
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

const assertCanUseAi = async (userId: string) => {
  const creditSummary = await getWalletSummary(userId);
  const subscription = await getActiveSubscription(userId);
  const [proAccess, aiUnlimited] = await Promise.all([
    featureGateService.hasActiveEntitlement(userId, "PRO_ACCESS"),
    featureGateService.hasActiveEntitlement(userId, "AI_UNLIMITED"),
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
    throw new AppError(402, "Buy credits to use AI models", {
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

const chargeForAiRequest = async (requestId: string) => {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.creditLedger.findUnique({
        where: { requestId },
        select: { id: true },
      });
      if (existing) {
        return { charged: false, reason: "already_charged" as const };
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

      if (!log) return { charged: false, reason: "log_not_found" as const };
      if (log.status !== "OK") return { charged: false, reason: "not_ok" as const };
      if (log.charged) return { charged: false, reason: "already_charged_flag" as const };
      if (log.totalTokens <= 0 || log.completionTokens <= 0) {
        return { charged: false, reason: "no_completion_tokens" as const };
      }
      const [subscription, proAccess, aiUnlimited] = await Promise.all([
        getActiveSubscription(log.userId),
        featureGateService.hasActiveEntitlement(log.userId, "PRO_ACCESS"),
        featureGateService.hasActiveEntitlement(log.userId, "AI_UNLIMITED"),
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
        } as const;
      }

      const normalizedModel = resolveLoggedModel(log.model);
      const costCredits = toCredits({
        totalTokens: log.totalTokens,
        model: normalizedModel,
      });
      if (costCredits <= 0) return { charged: false, reason: "zero_cost" as const };

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
          type: CreditLedgerType.DEBIT,
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

      if (costCredits >= env.AI_CREDIT_DRAIN_ALERT_THRESHOLD) {
        console.warn(
          `[ai-credit-alert] High credit drain`,
          JSON.stringify({
            requestId: log.requestId,
            userId: log.userId,
            model: normalizedModel,
            totalTokens: log.totalTokens,
            costCredits,
            balanceAfter: nextBalance,
          })
        );
        void securityService.logSecurityEvent({
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

      if (nextBalance < -10_000) {
        void securityService.logSecurityEvent({
          userId: log.userId,
          type: "BILLING_ANOMALY",
          requestId: log.requestId,
          details: {
            reason: "extreme_negative_balance",
            balanceAfter: nextBalance,
          },
        });
      }

      console.info(
        JSON.stringify({
          event: "ai.billing.charge",
          requestId: log.requestId,
          traceId: traceService.getTraceContext()?.traceId ?? null,
          userId: log.userId,
          provider: log.provider,
          model: log.model,
          tokensTotal: log.totalTokens,
          credits: costCredits,
          charged: true,
        })
      );

      return {
        charged: true,
        credits: costCredits,
        balanceAfter: nextBalance,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
};

const refundAiRequest = async (requestId: string, note = "Manual refund") => {
  return prisma.$transaction(
    async (tx) => {
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
      if (!log) throw new AppError(404, "Request not found");
      if (!log.charged || log.costCredits <= 0) {
        throw new AppError(400, "Request has no charge to refund");
      }

      const existingRefund = await tx.creditLedger.findFirst({
        where: {
          requestId: `${log.requestId}:refund`,
          type: CreditLedgerType.REFUND,
        },
        select: { id: true },
      });
      if (existingRefund) {
        return { refunded: false, reason: "already_refunded" as const };
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
          type: CreditLedgerType.REFUND,
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
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
};

export const creditsService = {
  chargeForAiRequest,
  refundAiRequest,
  getWalletSummary,
  assertCanUseAi,
  hasActiveSubscription,
  getActiveSubscription,
};
