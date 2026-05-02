import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { requirePermission } from "../../middlewares/requirePermission";
import { requireAdminIpAllowlist } from "../../middlewares/requireAdminIpAllowlist";
import { requireSuperadminStepUp } from "../../middlewares/requireSuperadminStepUp";
import {
  getOpsAlerts,
  getOpsDailyDashboard,
  getOpsLiveMetrics,
  postOpsAlertAcknowledge,
  postOpsAlertResolve,
  postOpsEvaluateAlerts,
  postOpsTriggerAlert,
  postOpsRunRollup,
} from "./observability.controller";

const observabilityRouter = Router();

observabilityRouter.get(
  "/metrics/live",
  requireAuth,
  requirePermission("ops.metrics.read"),
  getOpsLiveMetrics
);
observabilityRouter.get(
  "/dashboard/daily",
  requireAuth,
  requirePermission("ops.metrics.read"),
  getOpsDailyDashboard
);
observabilityRouter.post(
  "/rollup/run",
  requireAuth,
  requirePermission("ops.metrics.write"),
  requireAdminIpAllowlist,
  requireSuperadminStepUp,
  postOpsRunRollup
);
observabilityRouter.post(
  "/alerts/evaluate",
  requireAuth,
  requirePermission("ops.metrics.write"),
  requireAdminIpAllowlist,
  requireSuperadminStepUp,
  postOpsEvaluateAlerts
);
observabilityRouter.get(
  "/alerts",
  requireAuth,
  requirePermission("ops.alerts.read"),
  getOpsAlerts
);
observabilityRouter.post(
  "/alerts/ack",
  requireAuth,
  requirePermission("ops.alerts.write"),
  requireAdminIpAllowlist,
  requireSuperadminStepUp,
  postOpsAlertAcknowledge
);
observabilityRouter.post(
  "/alerts/resolve",
  requireAuth,
  requirePermission("ops.alerts.write"),
  requireAdminIpAllowlist,
  requireSuperadminStepUp,
  postOpsAlertResolve
);
observabilityRouter.post(
  "/alerts/trigger",
  requireAuth,
  requirePermission("ops.alerts.write"),
  requireAdminIpAllowlist,
  requireSuperadminStepUp,
  postOpsTriggerAlert
);

export { observabilityRouter };
