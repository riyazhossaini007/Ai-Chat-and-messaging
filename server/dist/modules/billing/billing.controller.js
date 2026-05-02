"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postAdminSubscriptionProviderReconcile = exports.postRazorpayWebhook = exports.postStripeWebhook = exports.postAdminReconcile = exports.postAdminRefund = exports.getAdminLedger = exports.getAdminRequestLogs = exports.postAdminSubscription = exports.postAdminPlan = exports.getPlans = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const billing_service_1 = require("./billing.service");
const billing_webhook_service_1 = require("./billing.webhook.service");
const getPlans = async (_req, res, next) => {
    try {
        const plans = await billing_service_1.billingService.getPlans();
        return (0, response_1.sendSuccess)(res, { plans });
    }
    catch (error) {
        return next(error);
    }
};
exports.getPlans = getPlans;
const postAdminPlan = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = req.body;
        const plan = await billing_service_1.billingService.createPlan(body);
        return (0, response_1.sendSuccess)(res, { plan }, "Plan created", 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.postAdminPlan = postAdminPlan;
const postAdminSubscription = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = req.body;
        const subscription = await billing_service_1.billingService.upsertSubscription({
            ...body,
            currentPeriodStart: new Date(body.currentPeriodStart),
            currentPeriodEnd: new Date(body.currentPeriodEnd),
        });
        return (0, response_1.sendSuccess)(res, { subscription }, "Subscription upserted");
    }
    catch (error) {
        return next(error);
    }
};
exports.postAdminSubscription = postAdminSubscription;
const getAdminRequestLogs = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
        const limit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
        const logs = await billing_service_1.billingService.listAiRequestLogs({ userId, limit });
        return (0, response_1.sendSuccess)(res, { logs });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminRequestLogs = getAdminRequestLogs;
const getAdminLedger = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
        const limit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
        const entries = await billing_service_1.billingService.listLedger({ userId, limit });
        return (0, response_1.sendSuccess)(res, { entries });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminLedger = getAdminLedger;
const postAdminRefund = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = req.body;
        if (!body.requestId || typeof body.requestId !== "string") {
            throw new errorHandler_1.AppError(400, "requestId is required");
        }
        const result = await billing_service_1.billingService.issueRefund({
            requestId: body.requestId.trim(),
            note: body.note,
            actorUserId: req.user.id,
        });
        return (0, response_1.sendSuccess)(res, { result }, "Refund processed");
    }
    catch (error) {
        return next(error);
    }
};
exports.postAdminRefund = postAdminRefund;
const postAdminReconcile = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = req.body;
        const hours = Math.max(1, Math.min(168, Number(body.hours ?? 24)));
        const result = await billing_service_1.billingService.reconcileUsageWindow({
            since: new Date(Date.now() - hours * 60 * 60 * 1000),
            applyAdjustments: Boolean(body.applyAdjustments),
        });
        return (0, response_1.sendSuccess)(res, { result }, "Reconciliation finished");
    }
    catch (error) {
        return next(error);
    }
};
exports.postAdminReconcile = postAdminReconcile;
const postStripeWebhook = async (req, res, next) => {
    try {
        const rawBody = req.rawBody;
        const signature = String(req.headers["stripe-signature"] ?? "").trim();
        if (!rawBody || rawBody.length === 0) {
            throw new errorHandler_1.AppError(400, "Raw webhook payload is required");
        }
        if (!signature) {
            throw new errorHandler_1.AppError(400, "Missing stripe-signature header");
        }
        await billing_webhook_service_1.billingWebhookService.handleStripeWebhook({
            rawBody,
            signatureHeader: signature,
            parsedBody: req.body,
        });
        return res.status(200).json({ received: true });
    }
    catch (error) {
        return next(error);
    }
};
exports.postStripeWebhook = postStripeWebhook;
const postRazorpayWebhook = async (req, res, next) => {
    try {
        const rawBody = req.rawBody;
        const signature = String(req.headers["x-razorpay-signature"] ?? "").trim();
        const eventIdHeader = String(req.headers["x-razorpay-event-id"] ?? "").trim();
        if (!rawBody || rawBody.length === 0) {
            throw new errorHandler_1.AppError(400, "Raw webhook payload is required");
        }
        if (!signature) {
            throw new errorHandler_1.AppError(400, "Missing x-razorpay-signature header");
        }
        await billing_webhook_service_1.billingWebhookService.handleRazorpayWebhook({
            rawBody,
            signatureHeader: signature,
            eventIdHeader: eventIdHeader || undefined,
            parsedBody: req.body,
        });
        return res.status(200).json({ received: true });
    }
    catch (error) {
        return next(error);
    }
};
exports.postRazorpayWebhook = postRazorpayWebhook;
const postAdminSubscriptionProviderReconcile = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = req.body;
        const result = await billing_webhook_service_1.billingWebhookService.reconcileSubscriptionsWithProviders({
            limit: body?.limit,
        });
        return (0, response_1.sendSuccess)(res, { result }, "Subscription provider reconciliation finished");
    }
    catch (error) {
        return next(error);
    }
};
exports.postAdminSubscriptionProviderReconcile = postAdminSubscriptionProviderReconcile;
