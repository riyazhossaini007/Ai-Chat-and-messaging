import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { requirePermission } from "../../middlewares/requirePermission";
import { requireAdminIpAllowlist } from "../../middlewares/requireAdminIpAllowlist";
import { requireSuperadminStepUp } from "../../middlewares/requireSuperadminStepUp";
import {
  getAdminLedger,
  getAdminRequestLogs,
  getPlans,
  postAdminSubscriptionProviderReconcile,
  postAdminPlan,
  postAdminReconcile,
  postAdminRefund,
  postAdminSubscription,
  postRazorpayWebhook,
  postStripeWebhook,
} from "./billing.controller";

const billingRouter = Router();

billingRouter.get("/plans", getPlans);
billingRouter.post("/webhooks/stripe", postStripeWebhook);
billingRouter.post("/webhooks/razorpay", postRazorpayWebhook);
billingRouter.get(
  "/admin/requests",
  requireAuth,
  requirePermission("billing.ledger.read"),
  getAdminRequestLogs
);
billingRouter.get(
  "/admin/ledger",
  requireAuth,
  requirePermission("billing.ledger.read"),
  getAdminLedger
);
billingRouter.post(
  "/admin/plans",
  requireAuth,
  requirePermission("ai.config.write"),
  requireAdminIpAllowlist,
  requireSuperadminStepUp,
  postAdminPlan
);
billingRouter.post(
  "/admin/subscriptions",
  requireAuth,
  requirePermission("ai.config.write"),
  requireAdminIpAllowlist,
  requireSuperadminStepUp,
  postAdminSubscription
);
billingRouter.post(
  "/admin/refund",
  requireAuth,
  requirePermission("billing.refund.create"),
  requireAdminIpAllowlist,
  requireSuperadminStepUp,
  postAdminRefund
);
billingRouter.post(
  "/admin/reconcile",
  requireAuth,
  requirePermission("billing.ledger.read"),
  requireAdminIpAllowlist,
  requireSuperadminStepUp,
  postAdminReconcile
);
billingRouter.post(
  "/admin/subscriptions/reconcile",
  requireAuth,
  requirePermission("billing.ledger.read"),
  requireAdminIpAllowlist,
  requireSuperadminStepUp,
  postAdminSubscriptionProviderReconcile
);

export { billingRouter };
