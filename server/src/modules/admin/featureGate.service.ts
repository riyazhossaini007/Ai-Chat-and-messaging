import type { EntitlementFeatureKey } from "@prisma/client";
import { prisma } from "../../config/prisma";

const now = () => new Date();

const hasPaidPlan = async (userId: string) => {
  const [subscription, userSubscription] = await Promise.all([
    prisma.subscription.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        currentPeriodEnd: { gt: now() },
      },
      select: { id: true },
    }),
    prisma.userSubscription.findFirst({
      where: {
        userId,
        status: "active",
        validUntil: { gt: now() },
      },
      select: { id: true },
    }),
  ]);
  return Boolean(subscription || userSubscription);
};

const hasActiveEntitlement = async (userId: string, featureKey: EntitlementFeatureKey) => {
  const grant = await prisma.entitlementGrant.findFirst({
    where: {
      userId,
      featureKey,
      isRevoked: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }],
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  return Boolean(grant);
};

const impliedByProAccess = (featureKey: EntitlementFeatureKey) =>
  featureKey === "AI_UNLIMITED" ||
  featureKey === "CALLING" ||
  featureKey === "GROUP_CALLING" ||
  featureKey === "NO_ADS" ||
  featureKey === "PRO_ACCESS";

const canUseFeature = async (userId: string, featureKey: EntitlementFeatureKey) => {
  if (await hasPaidPlan(userId)) return true;
  if (await hasActiveEntitlement(userId, featureKey)) return true;
  if (impliedByProAccess(featureKey)) {
    return hasActiveEntitlement(userId, "PRO_ACCESS");
  }
  return false;
};

export const featureGateService = {
  canUseFeature,
  hasPaidPlan,
  hasActiveEntitlement,
};
