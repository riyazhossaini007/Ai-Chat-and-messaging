import { NextFunction, Response } from "express";
import { BillingProvider, SubscriptionStatus } from "@prisma/client";
import { AppError } from "../../middlewares/errorHandler";
import { AuthRequest } from "../../types";
import { sendSuccess } from "../../utils/response";
import { billingService } from "./billing.service";
import { billingWebhookService } from "./billing.webhook.service";

export const getPlans = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plans = await billingService.getPlans();
    return sendSuccess(res, { plans });
  } catch (error) {
    return next(error);
  }
};

export const postAdminPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = req.body as {
      name: string;
      priceMonthly: number;
      creditAllowance: number;
      modelAccess: unknown;
      maxTokensPerMonth: number;
    };
    const plan = await billingService.createPlan(body);
    return sendSuccess(res, { plan }, "Plan created", 201);
  } catch (error) {
    return next(error);
  }
};

export const postAdminSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = req.body as {
      userId: string;
      planId: string;
      status: SubscriptionStatus;
      billingProvider: BillingProvider;
      providerCustomerId?: string;
      providerSubscriptionId?: string;
      currentPeriodStart: string;
      currentPeriodEnd: string;
      cancelAtPeriodEnd?: boolean;
    };
    const subscription = await billingService.upsertSubscription({
      ...body,
      currentPeriodStart: new Date(body.currentPeriodStart),
      currentPeriodEnd: new Date(body.currentPeriodEnd),
    });
    return sendSuccess(res, { subscription }, "Subscription upserted");
  } catch (error) {
    return next(error);
  }
};

export const getAdminRequestLogs = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const limit =
      typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
    const logs = await billingService.listAiRequestLogs({ userId, limit });
    return sendSuccess(res, { logs });
  } catch (error) {
    return next(error);
  }
};

export const getAdminLedger = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const limit =
      typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
    const entries = await billingService.listLedger({ userId, limit });
    return sendSuccess(res, { entries });
  } catch (error) {
    return next(error);
  }
};

export const postAdminRefund = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = req.body as { requestId: string; note?: string };
    if (!body.requestId || typeof body.requestId !== "string") {
      throw new AppError(400, "requestId is required");
    }
    const result = await billingService.issueRefund({
      requestId: body.requestId.trim(),
      note: body.note,
      actorUserId: req.user!.id,
    });
    return sendSuccess(res, { result }, "Refund processed");
  } catch (error) {
    return next(error);
  }
};

export const postAdminReconcile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = req.body as { hours?: number; applyAdjustments?: boolean };
    const hours = Math.max(1, Math.min(168, Number(body.hours ?? 24)));
    const result = await billingService.reconcileUsageWindow({
      since: new Date(Date.now() - hours * 60 * 60 * 1000),
      applyAdjustments: Boolean(body.applyAdjustments),
    });
    return sendSuccess(res, { result }, "Reconciliation finished");
  } catch (error) {
    return next(error);
  }
};

export const postStripeWebhook = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const rawBody = req.rawBody;
    const signature = String(req.headers["stripe-signature"] ?? "").trim();
    if (!rawBody || rawBody.length === 0) {
      throw new AppError(400, "Raw webhook payload is required");
    }
    if (!signature) {
      throw new AppError(400, "Missing stripe-signature header");
    }
    await billingWebhookService.handleStripeWebhook({
      rawBody,
      signatureHeader: signature,
      parsedBody: req.body,
    });
    return res.status(200).json({ received: true });
  } catch (error) {
    return next(error);
  }
};

export const postRazorpayWebhook = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const rawBody = req.rawBody;
    const signature = String(req.headers["x-razorpay-signature"] ?? "").trim();
    const eventIdHeader = String(req.headers["x-razorpay-event-id"] ?? "").trim();
    if (!rawBody || rawBody.length === 0) {
      throw new AppError(400, "Raw webhook payload is required");
    }
    if (!signature) {
      throw new AppError(400, "Missing x-razorpay-signature header");
    }
    await billingWebhookService.handleRazorpayWebhook({
      rawBody,
      signatureHeader: signature,
      eventIdHeader: eventIdHeader || undefined,
      parsedBody: req.body,
    });
    return res.status(200).json({ received: true });
  } catch (error) {
    return next(error);
  }
};

export const postAdminSubscriptionProviderReconcile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = req.body as { limit?: number };
    const result = await billingWebhookService.reconcileSubscriptionsWithProviders({
      limit: body?.limit,
    });
    return sendSuccess(res, { result }, "Subscription provider reconciliation finished");
  } catch (error) {
    return next(error);
  }
};
