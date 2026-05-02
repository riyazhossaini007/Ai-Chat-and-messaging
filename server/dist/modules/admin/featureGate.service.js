"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureGateService = void 0;
const prisma_1 = require("../../config/prisma");
const now = () => new Date();
const hasPaidPlan = async (userId) => {
    const [subscription, userSubscription] = await Promise.all([
        prisma_1.prisma.subscription.findFirst({
            where: {
                userId,
                status: "ACTIVE",
                currentPeriodEnd: { gt: now() },
            },
            select: { id: true },
        }),
        prisma_1.prisma.userSubscription.findFirst({
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
const hasActiveEntitlement = async (userId, featureKey) => {
    const grant = await prisma_1.prisma.entitlementGrant.findFirst({
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
const impliedByProAccess = (featureKey) => featureKey === "AI_UNLIMITED" ||
    featureKey === "CALLING" ||
    featureKey === "GROUP_CALLING" ||
    featureKey === "NO_ADS" ||
    featureKey === "PRO_ACCESS";
const canUseFeature = async (userId, featureKey) => {
    if (await hasPaidPlan(userId))
        return true;
    if (await hasActiveEntitlement(userId, featureKey))
        return true;
    if (impliedByProAccess(featureKey)) {
        return hasActiveEntitlement(userId, "PRO_ACCESS");
    }
    return false;
};
exports.featureGateService = {
    canUseFeature,
    hasPaidPlan,
    hasActiveEntitlement,
};
