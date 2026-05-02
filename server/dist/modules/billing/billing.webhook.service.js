"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingWebhookService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
const errorHandler_1 = require("../../middlewares/errorHandler");
const timingSafeEqualHex = (a, b) => {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length !== right.length)
        return false;
    return node_crypto_1.default.timingSafeEqual(left, right);
};
const sha256Hex = (value) => node_crypto_1.default.createHash("sha256").update(value).digest("hex");
const mapStripeStatus = (status) => {
    const normalized = status.trim().toLowerCase();
    if (normalized === "active" || normalized === "trialing")
        return "ACTIVE";
    if (normalized === "canceled")
        return "CANCELLED";
    if (normalized === "incomplete_expired")
        return "EXPIRED";
    if (normalized === "past_due" || normalized === "unpaid" || normalized === "incomplete") {
        return "PAST_DUE";
    }
    return "PAST_DUE";
};
const mapRazorpayStatus = (status) => {
    const normalized = status.trim().toLowerCase();
    if (normalized === "active" || normalized === "authenticated")
        return "ACTIVE";
    if (normalized === "cancelled")
        return "CANCELLED";
    if (normalized === "completed" || normalized === "expired")
        return "EXPIRED";
    if (normalized === "halted" || normalized === "pending")
        return "PAST_DUE";
    return "PAST_DUE";
};
const defaultPlanId = async () => {
    const plan = await prisma_1.prisma.plan.findFirst({
        orderBy: { priceMonthly: "asc" },
        select: { id: true },
    });
    if (!plan)
        throw new errorHandler_1.AppError(500, "No plan found for subscription bootstrap");
    return plan.id;
};
const resolveUserAndPlan = async (input) => {
    const existingBySub = input.providerSubscriptionId
        ? await prisma_1.prisma.subscription.findFirst({
            where: {
                billingProvider: input.provider,
                providerSubscriptionId: input.providerSubscriptionId,
            },
            orderBy: { updatedAt: "desc" },
        })
        : null;
    if (existingBySub) {
        return { userId: existingBySub.userId, planId: existingBySub.planId, existing: existingBySub };
    }
    const existingByCustomer = input.providerCustomerId
        ? await prisma_1.prisma.subscription.findFirst({
            where: {
                billingProvider: input.provider,
                providerCustomerId: input.providerCustomerId,
            },
            orderBy: { updatedAt: "desc" },
        })
        : null;
    if (existingByCustomer) {
        return {
            userId: existingByCustomer.userId,
            planId: existingByCustomer.planId,
            existing: existingByCustomer,
        };
    }
    const metadataUser = input.metadataUserId
        ? await prisma_1.prisma.user.findUnique({
            where: { id: input.metadataUserId },
            select: { id: true },
        })
        : null;
    if (metadataUser) {
        const planId = input.metadataPlanId || (await defaultPlanId());
        return { userId: metadataUser.id, planId, existing: null };
    }
    return { userId: null, planId: null, existing: null };
};
const isOutOfOrderEvent = async (input) => {
    if (!input.providerSubscriptionId || !input.providerCreatedAt)
        return false;
    const latest = await prisma_1.prisma.subscriptionWebhookEvent.findFirst({
        where: {
            provider: input.provider,
            providerSubscriptionId: input.providerSubscriptionId,
            status: "PROCESSED",
            providerCreatedAt: { not: null },
        },
        orderBy: { providerCreatedAt: "desc" },
        select: { providerCreatedAt: true },
    });
    if (!latest?.providerCreatedAt)
        return false;
    return input.providerCreatedAt.getTime() < latest.providerCreatedAt.getTime();
};
const createEventIfNew = async (input) => {
    try {
        const created = await prisma_1.prisma.subscriptionWebhookEvent.create({
            data: {
                provider: input.provider,
                eventId: input.eventId,
                eventType: input.eventType,
                providerCreatedAt: input.providerCreatedAt ?? null,
                signatureVerified: input.signatureVerified,
                rawPayload: input.rawPayload,
                providerSubscriptionId: input.providerSubscriptionId,
                providerCustomerId: input.providerCustomerId,
                status: "RECEIVED",
            },
        });
        return { event: created, duplicate: false };
    }
    catch (error) {
        if (error instanceof Error && /Unique constraint failed/i.test(error.message)) {
            await prisma_1.prisma.subscriptionWebhookEvent.updateMany({
                where: { provider: input.provider, eventId: input.eventId },
                data: { attemptCount: { increment: 1 } },
            });
            return { event: null, duplicate: true };
        }
        throw error;
    }
};
const updateEventStatus = async (id, input) => {
    await prisma_1.prisma.subscriptionWebhookEvent.update({
        where: { id },
        data: {
            status: input.status,
            ignoredOutOfOrder: Boolean(input.ignoredOutOfOrder),
            errorMessage: input.errorMessage ?? null,
            subscriptionId: input.subscriptionId ?? null,
            userId: input.userId ?? null,
            processedAt: new Date(),
        },
    });
};
const verifyStripeSignature = (rawBody, signatureHeader) => {
    if (!env_1.env.STRIPE_WEBHOOK_SECRET) {
        throw new errorHandler_1.AppError(503, "Stripe webhook secret is not configured");
    }
    const parts = signatureHeader.split(",").map((part) => part.trim());
    const tPart = parts.find((part) => part.startsWith("t="));
    const v1Parts = parts.filter((part) => part.startsWith("v1="));
    if (!tPart || v1Parts.length === 0)
        return false;
    const timestamp = tPart.slice(2);
    const payload = `${timestamp}.${rawBody.toString("utf8")}`;
    const expected = node_crypto_1.default
        .createHmac("sha256", env_1.env.STRIPE_WEBHOOK_SECRET)
        .update(payload)
        .digest("hex");
    return v1Parts.some((part) => timingSafeEqualHex(expected, part.slice(3)));
};
const processStripeSubscriptionState = async (input) => {
    const providerSubscriptionId = String(input.object.id ?? "").trim();
    const providerCustomerId = String(input.object.customer ?? "").trim();
    const metadata = (input.object.metadata ?? {});
    const metadataUserId = typeof metadata.userId === "string" ? metadata.userId : undefined;
    const metadataPlanId = typeof metadata.planId === "string" ? metadata.planId : undefined;
    const providerCreatedAt = input.event.created ? new Date(input.event.created * 1000) : null;
    const statusRaw = String(input.object.status ?? "").trim();
    const mappedStatus = mapStripeStatus(statusRaw);
    const currentPeriodStartRaw = Number(input.object.current_period_start ?? 0);
    const currentPeriodEndRaw = Number(input.object.current_period_end ?? 0);
    const cancelAtPeriodEnd = Boolean(input.object.cancel_at_period_end);
    const eventRow = await createEventIfNew({
        provider: "STRIPE",
        eventId: input.event.id,
        eventType: input.event.type,
        providerCreatedAt,
        rawPayload: input.event,
        signatureVerified: true,
        providerSubscriptionId,
        providerCustomerId,
    });
    if (eventRow.duplicate)
        return { accepted: true, duplicate: true };
    if (!eventRow.event)
        return { accepted: true, duplicate: true };
    if (await isOutOfOrderEvent({
        provider: "STRIPE",
        providerSubscriptionId,
        providerCreatedAt,
    })) {
        await updateEventStatus(eventRow.event.id, {
            status: "IGNORED",
            ignoredOutOfOrder: true,
        });
        return { accepted: true, ignoredOutOfOrder: true };
    }
    const resolved = await resolveUserAndPlan({
        provider: "STRIPE",
        providerCustomerId,
        providerSubscriptionId,
        metadataUserId,
        metadataPlanId,
    });
    if (!resolved.userId || !resolved.planId) {
        await updateEventStatus(eventRow.event.id, {
            status: "ERROR",
            errorMessage: "Cannot resolve user/plan for Stripe subscription event",
        });
        return { accepted: true, unresolved: true };
    }
    const currentPeriodStart = currentPeriodStartRaw > 0 ? new Date(currentPeriodStartRaw * 1000) : new Date();
    const currentPeriodEnd = currentPeriodEndRaw > 0
        ? new Date(currentPeriodEndRaw * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const subscription = resolved.existing
        ? await prisma_1.prisma.subscription.update({
            where: { id: resolved.existing.id },
            data: {
                userId: resolved.userId,
                planId: resolved.planId,
                status: mappedStatus,
                billingProvider: "STRIPE",
                providerCustomerId,
                providerSubscriptionId,
                currentPeriodStart,
                currentPeriodEnd,
                cancelAtPeriodEnd,
            },
        })
        : await prisma_1.prisma.subscription.create({
            data: {
                userId: resolved.userId,
                planId: resolved.planId,
                status: mappedStatus,
                billingProvider: "STRIPE",
                providerCustomerId,
                providerSubscriptionId,
                currentPeriodStart,
                currentPeriodEnd,
                cancelAtPeriodEnd,
            },
        });
    await updateEventStatus(eventRow.event.id, {
        status: "PROCESSED",
        subscriptionId: subscription.id,
        userId: subscription.userId,
    });
    return { accepted: true, processed: true };
};
const processStripeInvoiceState = async (input) => {
    const invoice = input.object;
    const providerSubscriptionId = String(invoice.subscription ?? "").trim();
    const providerCustomerId = String(invoice.customer ?? "").trim();
    const providerCreatedAt = input.event.created ? new Date(input.event.created * 1000) : null;
    const paid = Boolean(invoice.paid);
    const statusRaw = String(invoice.status ?? "").trim().toLowerCase();
    const mappedStatus = paid || statusRaw === "paid" ? "ACTIVE" : "PAST_DUE";
    const eventRow = await createEventIfNew({
        provider: "STRIPE",
        eventId: input.event.id,
        eventType: input.event.type,
        providerCreatedAt,
        rawPayload: input.event,
        signatureVerified: true,
        providerSubscriptionId,
        providerCustomerId,
    });
    if (eventRow.duplicate)
        return { accepted: true, duplicate: true };
    if (!eventRow.event)
        return { accepted: true, duplicate: true };
    if (await isOutOfOrderEvent({
        provider: "STRIPE",
        providerSubscriptionId,
        providerCreatedAt,
    })) {
        await updateEventStatus(eventRow.event.id, {
            status: "IGNORED",
            ignoredOutOfOrder: true,
        });
        return { accepted: true, ignoredOutOfOrder: true };
    }
    const subscription = providerSubscriptionId
        ? await prisma_1.prisma.subscription.findFirst({
            where: {
                billingProvider: "STRIPE",
                providerSubscriptionId,
            },
            orderBy: { updatedAt: "desc" },
        })
        : null;
    if (!subscription) {
        await updateEventStatus(eventRow.event.id, {
            status: "ERROR",
            errorMessage: "Subscription not found for Stripe invoice event",
        });
        return { accepted: true, unresolved: true };
    }
    const updated = await prisma_1.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
            status: mappedStatus,
            providerCustomerId: providerCustomerId || subscription.providerCustomerId,
        },
    });
    await updateEventStatus(eventRow.event.id, {
        status: "PROCESSED",
        subscriptionId: updated.id,
        userId: updated.userId,
    });
    return { accepted: true, processed: true };
};
const handleStripeWebhook = async (input) => {
    const signatureVerified = verifyStripeSignature(input.rawBody, input.signatureHeader);
    const parsed = input.parsedBody;
    const eventId = typeof parsed?.id === "string" ? parsed.id : sha256Hex(input.rawBody);
    if (!signatureVerified) {
        const created = await createEventIfNew({
            provider: "STRIPE",
            eventId,
            eventType: typeof parsed?.type === "string" ? parsed.type : "unknown",
            providerCreatedAt: parsed?.created ? new Date(parsed.created * 1000) : null,
            rawPayload: parsed ?? { raw: input.rawBody.toString("utf8") },
            signatureVerified: false,
            providerSubscriptionId: undefined,
            providerCustomerId: undefined,
        });
        if (!created.duplicate && created.event) {
            await updateEventStatus(created.event.id, {
                status: "ERROR",
                errorMessage: "Invalid Stripe signature",
            });
        }
        throw new errorHandler_1.AppError(400, "Invalid Stripe webhook signature");
    }
    if (!parsed || typeof parsed !== "object" || !parsed.type) {
        throw new errorHandler_1.AppError(400, "Invalid Stripe webhook payload");
    }
    const object = (parsed.data?.object ?? {});
    if (parsed.type.startsWith("customer.subscription.")) {
        return processStripeSubscriptionState({ event: parsed, object });
    }
    if (parsed.type.startsWith("invoice.")) {
        return processStripeInvoiceState({ event: parsed, object });
    }
    const created = await createEventIfNew({
        provider: "STRIPE",
        eventId: parsed.id,
        eventType: parsed.type,
        providerCreatedAt: parsed.created ? new Date(parsed.created * 1000) : null,
        rawPayload: parsed,
        signatureVerified: true,
    });
    if (!created.duplicate && created.event) {
        await updateEventStatus(created.event.id, { status: "IGNORED" });
    }
    return { accepted: true, ignored: true };
};
const verifyRazorpaySignature = (rawBody, signatureHeader) => {
    if (!env_1.env.RAZORPAY_WEBHOOK_SECRET) {
        throw new errorHandler_1.AppError(503, "Razorpay webhook secret is not configured");
    }
    const expected = node_crypto_1.default
        .createHmac("sha256", env_1.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");
    return timingSafeEqualHex(expected, signatureHeader.trim());
};
const handleRazorpayWebhook = async (input) => {
    const signatureVerified = verifyRazorpaySignature(input.rawBody, input.signatureHeader);
    const payload = input.parsedBody;
    const eventType = String(payload?.event ?? "unknown");
    const providerCreatedAt = typeof payload?.created_at === "number" ? new Date(payload.created_at * 1000) : null;
    const providerSubscription = (payload?.payload?.subscription ?? {});
    const subEntity = (providerSubscription.entity ?? {});
    const providerSubscriptionId = String(subEntity.id ?? "").trim() || undefined;
    const providerCustomerId = String(subEntity.customer_id ?? "").trim() || undefined;
    const eventId = input.eventIdHeader?.trim() || sha256Hex(input.rawBody);
    const created = await createEventIfNew({
        provider: "RAZORPAY",
        eventId,
        eventType,
        providerCreatedAt,
        rawPayload: payload,
        signatureVerified,
        providerSubscriptionId,
        providerCustomerId,
    });
    if (created.duplicate)
        return { accepted: true, duplicate: true };
    if (!created.event)
        return { accepted: true, duplicate: true };
    if (!signatureVerified) {
        await updateEventStatus(created.event.id, {
            status: "ERROR",
            errorMessage: "Invalid Razorpay signature",
        });
        throw new errorHandler_1.AppError(400, "Invalid Razorpay webhook signature");
    }
    if (await isOutOfOrderEvent({
        provider: "RAZORPAY",
        providerSubscriptionId,
        providerCreatedAt,
    })) {
        await updateEventStatus(created.event.id, {
            status: "IGNORED",
            ignoredOutOfOrder: true,
        });
        return { accepted: true, ignoredOutOfOrder: true };
    }
    if (!providerSubscriptionId) {
        await updateEventStatus(created.event.id, {
            status: "IGNORED",
            errorMessage: "No subscription id in Razorpay event",
        });
        return { accepted: true, ignored: true };
    }
    const metadata = (subEntity.notes ?? {});
    const metadataUserId = typeof metadata.userId === "string" ? metadata.userId : undefined;
    const metadataPlanId = typeof metadata.planId === "string" ? metadata.planId : undefined;
    const resolved = await resolveUserAndPlan({
        provider: "RAZORPAY",
        providerSubscriptionId,
        providerCustomerId,
        metadataUserId,
        metadataPlanId,
    });
    if (!resolved.userId || !resolved.planId) {
        await updateEventStatus(created.event.id, {
            status: "ERROR",
            errorMessage: "Cannot resolve user/plan for Razorpay event",
        });
        return { accepted: true, unresolved: true };
    }
    const startAtRaw = Number(subEntity.current_start ?? subEntity.start_at ?? 0);
    const endAtRaw = Number(subEntity.current_end ?? subEntity.end_at ?? 0);
    const currentPeriodStart = startAtRaw > 0 ? new Date(startAtRaw * 1000) : new Date();
    const currentPeriodEnd = endAtRaw > 0
        ? new Date(endAtRaw * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const mappedStatus = mapRazorpayStatus(String(subEntity.status ?? ""));
    const subscription = resolved.existing
        ? await prisma_1.prisma.subscription.update({
            where: { id: resolved.existing.id },
            data: {
                userId: resolved.userId,
                planId: resolved.planId,
                status: mappedStatus,
                billingProvider: "RAZORPAY",
                providerCustomerId,
                providerSubscriptionId,
                currentPeriodStart,
                currentPeriodEnd,
                cancelAtPeriodEnd: mappedStatus === "CANCELLED",
            },
        })
        : await prisma_1.prisma.subscription.create({
            data: {
                userId: resolved.userId,
                planId: resolved.planId,
                status: mappedStatus,
                billingProvider: "RAZORPAY",
                providerCustomerId,
                providerSubscriptionId,
                currentPeriodStart,
                currentPeriodEnd,
                cancelAtPeriodEnd: mappedStatus === "CANCELLED",
            },
        });
    await updateEventStatus(created.event.id, {
        status: "PROCESSED",
        subscriptionId: subscription.id,
        userId: subscription.userId,
    });
    return { accepted: true, processed: true };
};
const fetchStripeSubscription = async (providerSubscriptionId) => {
    if (!env_1.env.STRIPE_API_KEY)
        return null;
    const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(providerSubscriptionId)}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${env_1.env.STRIPE_API_KEY}`,
        },
    });
    if (!response.ok)
        return null;
    return (await response.json());
};
const fetchRazorpaySubscription = async (providerSubscriptionId) => {
    if (!env_1.env.RAZORPAY_KEY_ID || !env_1.env.RAZORPAY_KEY_SECRET)
        return null;
    const auth = Buffer.from(`${env_1.env.RAZORPAY_KEY_ID}:${env_1.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(providerSubscriptionId)}`, {
        method: "GET",
        headers: {
            Authorization: `Basic ${auth}`,
        },
    });
    if (!response.ok)
        return null;
    return (await response.json());
};
const reconcileSubscriptionsWithProviders = async (input) => {
    const limit = Math.max(1, Math.min(1000, input?.limit ?? env_1.env.SUBSCRIPTION_RECONCILIATION_BATCH_SIZE));
    const rows = await prisma_1.prisma.subscription.findMany({
        where: {
            status: { in: ["ACTIVE", "PAST_DUE"] },
            billingProvider: { in: ["STRIPE", "RAZORPAY"] },
            providerSubscriptionId: { not: null },
        },
        orderBy: { updatedAt: "asc" },
        take: limit,
    });
    let checked = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];
    for (const subscription of rows) {
        checked += 1;
        try {
            const providerSubscriptionId = subscription.providerSubscriptionId;
            if (!providerSubscriptionId) {
                skipped += 1;
                continue;
            }
            const providerPayload = subscription.billingProvider === "STRIPE"
                ? await fetchStripeSubscription(providerSubscriptionId)
                : await fetchRazorpaySubscription(providerSubscriptionId);
            if (!providerPayload) {
                skipped += 1;
                continue;
            }
            const providerStatus = subscription.billingProvider === "STRIPE"
                ? mapStripeStatus(String(providerPayload.status ?? "past_due"))
                : mapRazorpayStatus(String(providerPayload.status ?? "pending"));
            const nextPeriodStartRaw = subscription.billingProvider === "STRIPE"
                ? Number(providerPayload.current_period_start ?? 0)
                : Number(providerPayload.current_start ?? providerPayload.start_at ?? 0);
            const nextPeriodEndRaw = subscription.billingProvider === "STRIPE"
                ? Number(providerPayload.current_period_end ?? 0)
                : Number(providerPayload.current_end ?? providerPayload.end_at ?? 0);
            const nextPeriodStart = nextPeriodStartRaw > 0 ? new Date(nextPeriodStartRaw * 1000) : subscription.currentPeriodStart;
            const nextPeriodEnd = nextPeriodEndRaw > 0 ? new Date(nextPeriodEndRaw * 1000) : subscription.currentPeriodEnd;
            const nextCancelAtPeriodEnd = subscription.billingProvider === "STRIPE"
                ? Boolean(providerPayload.cancel_at_period_end)
                : providerStatus === "CANCELLED";
            if (providerStatus !== subscription.status ||
                nextPeriodEnd.getTime() !== subscription.currentPeriodEnd.getTime() ||
                nextCancelAtPeriodEnd !== subscription.cancelAtPeriodEnd) {
                await prisma_1.prisma.subscription.update({
                    where: { id: subscription.id },
                    data: {
                        status: providerStatus,
                        currentPeriodStart: nextPeriodStart,
                        currentPeriodEnd: nextPeriodEnd,
                        cancelAtPeriodEnd: nextCancelAtPeriodEnd,
                    },
                });
                updated += 1;
            }
        }
        catch (error) {
            errors.push({
                subscriptionId: subscription.id,
                reason: error instanceof Error ? error.message : "unknown",
            });
        }
    }
    return {
        checked,
        updated,
        skipped,
        errors,
    };
};
exports.billingWebhookService = {
    handleStripeWebhook,
    handleRazorpayWebhook,
    reconcileSubscriptionsWithProviders,
};
