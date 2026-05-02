import {
  BillingProvider,
  CreditLedgerType,
  ReconciliationStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../middlewares/errorHandler";
import { creditsService } from "../credits/credits.service";

const getPlans = async () => {
  return prisma.plan.findMany({
    orderBy: { priceMonthly: "asc" },
  });
};

const createPlan = async (input: {
  name: string;
  priceMonthly: number;
  creditAllowance: number;
  modelAccess: unknown;
  maxTokensPerMonth: number;
}) => {
  return prisma.plan.create({
    data: {
      name: input.name.trim(),
      priceMonthly: input.priceMonthly,
      creditAllowance: input.creditAllowance,
      modelAccess: input.modelAccess as object,
      maxTokensPerMonth: input.maxTokensPerMonth,
    },
  });
};

const upsertSubscription = async (input: {
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  billingProvider: BillingProvider;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd?: boolean;
}) => {
  const existing = await prisma.subscription.findFirst({
    where: {
      userId: input.userId,
      providerSubscriptionId: input.providerSubscriptionId ?? undefined,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    return prisma.subscription.update({
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

  return prisma.subscription.create({
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

const listAiRequestLogs = async (input: { userId?: string; limit?: number }) => {
  return prisma.aiRequestLog.findMany({
    where: input.userId ? { userId: input.userId } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(1, input.limit ?? 100), 500),
  });
};

const listLedger = async (input: { userId?: string; limit?: number }) => {
  return prisma.creditLedger.findMany({
    where: input.userId ? { userId: input.userId } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(1, input.limit ?? 100), 500),
  });
};

const issueRefund = async (input: { requestId: string; note?: string; actorUserId: string }) => {
  const result = await creditsService.refundAiRequest(
    input.requestId,
    input.note ? `Refund by ${input.actorUserId}: ${input.note}` : `Refund by ${input.actorUserId}`
  );
  console.info(
    JSON.stringify({
      event: "billing.refund.issued",
      actorUserId: input.actorUserId,
      requestId: input.requestId,
      result,
      at: new Date().toISOString(),
    })
  );
  return result;
};

const extractProviderTotalTokens = (provider: string, usageRaw: unknown) => {
  if (!usageRaw || typeof usageRaw !== "object") return null;
  const raw = usageRaw as Record<string, unknown>;
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

const reconcileUsageWindow = async (input: {
  since: Date;
  applyAdjustments: boolean;
}) => {
  const logs = await prisma.aiRequestLog.findMany({
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
    if (providerTokens === null) continue;

    const delta = providerTokens - storedTokens;
    const absDelta = Math.abs(delta);
    const status =
      absDelta > env.AI_RECONCILIATION_MISMATCH_THRESHOLD
        ? ReconciliationStatus.MISMATCH
        : ReconciliationStatus.OK;

    await prisma.usageReconciliation.create({
      data: {
        requestId: log.requestId,
        userId: log.userId,
        storedTokens,
        providerTokens,
        delta,
        status,
      },
    });

    if (status === ReconciliationStatus.MISMATCH) mismatches += 1;

    if (!input.applyAdjustments || status !== ReconciliationStatus.MISMATCH || !log.charged) {
      continue;
    }

    const alreadyAdjusted = await prisma.creditLedger.findFirst({
      where: { requestId: `${log.requestId}:recon` },
      select: { id: true },
    });
    if (alreadyAdjusted) continue;

    const wallet = await prisma.userCreditWallet.upsert({
      where: { userId: log.userId },
      create: { userId: log.userId, balanceCredits: 0 },
      update: {},
    });

    const tokenDeltaK = delta / 1000;
    const creditDelta = Math.ceil(Math.abs(tokenDeltaK) * env.AI_CREDITS_PER_1K_TOKENS);
    if (creditDelta <= 0) continue;

    const positive = delta < 0;
    const nextBalance = positive
      ? wallet.balanceCredits + creditDelta
      : wallet.balanceCredits - creditDelta;

    await prisma.$transaction(async (tx) => {
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
          type: positive ? CreditLedgerType.CREDIT : CreditLedgerType.DEBIT,
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
          status: ReconciliationStatus.ADJUSTED,
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
  const count = await prisma.plan.count();
  if (count === 0) {
    await prisma.plan.createMany({
      data: [
        {
          name: "Starter",
          priceMonthly: 9,
          creditAllowance: 500,
          modelAccess: { openai: true, claude: true, gemini: true, grok: false },
          maxTokensPerMonth: 2_000_000,
        },
        {
          name: "Pro",
          priceMonthly: 29,
          creditAllowance: 2500,
          modelAccess: { openai: true, claude: true, gemini: true, grok: true },
          maxTokensPerMonth: 10_000_000,
        },
      ],
    });
  }
  await (prisma as any).systemConfig.upsert({
    where: { key: "MIGRATION_VERSION" },
    create: { key: "MIGRATION_VERSION", value: "20260216125000" },
    update: { value: "20260216125000" },
  });
};

export const billingService = {
  getPlans,
  createPlan,
  upsertSubscription,
  listAiRequestLogs,
  listLedger,
  issueRefund,
  reconcileUsageWindow,
  ensureBootstrapPlans,
};
