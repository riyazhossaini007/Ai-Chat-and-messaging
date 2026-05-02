import { NextFunction, Response } from "express";
import { AuthRequest } from "../../types";
import { AppError } from "../../middlewares/errorHandler";
import { sendSuccess } from "../../utils/response";
import { observabilityService } from "./observability.service";

export const getOpsLiveMetrics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const hours = Number(req.query.hours ?? "1");
    const data = await observabilityService.getLiveMetrics({ hours });
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
};

export const getOpsDailyDashboard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const days = Number(req.query.days ?? "30");
    const data = await observabilityService.getDailyDashboard({ days });
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
};

export const postOpsRunRollup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const dateRaw = String((req.body as Record<string, unknown>)?.date ?? "").trim();
    const date = dateRaw ? new Date(dateRaw) : undefined;
    const result = await observabilityService.runDailyRollup({
      date: date && !Number.isNaN(date.getTime()) ? date : undefined,
    });
    return sendSuccess(res, result, "Daily rollup complete");
  } catch (error) {
    return next(error);
  }
};

export const postOpsEvaluateAlerts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const result = await observabilityService.evaluateAlerts();
    return sendSuccess(res, result, "Alert evaluation complete");
  } catch (error) {
    return next(error);
  }
};

export const getOpsAlerts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const limit = Number(req.query.limit ?? "100");
    const statusRaw = String(req.query.status ?? "").trim().toUpperCase();
    const status =
      statusRaw === "OPEN" || statusRaw === "ACKNOWLEDGED" || statusRaw === "RESOLVED"
        ? (statusRaw as "OPEN" | "ACKNOWLEDGED" | "RESOLVED")
        : undefined;
    const alerts = await observabilityService.listAlerts({ limit, status });
    return sendSuccess(res, { alerts });
  } catch (error) {
    return next(error);
  }
};

export const postOpsAlertAcknowledge = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const id = String((req.body as Record<string, unknown>)?.id ?? "").trim();
    if (!id) throw new AppError(400, "id is required");
    const alert = await observabilityService.acknowledgeAlert(id);
    return sendSuccess(res, { alert }, "Alert acknowledged");
  } catch (error) {
    return next(error);
  }
};

export const postOpsAlertResolve = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const id = String((req.body as Record<string, unknown>)?.id ?? "").trim();
    if (!id) throw new AppError(400, "id is required");
    const alert = await observabilityService.resolveAlert(id);
    return sendSuccess(res, { alert }, "Alert resolved");
  } catch (error) {
    return next(error);
  }
};

export const postOpsTriggerAlert = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = req.body as Record<string, unknown>;
    const type = String(body.type ?? "").trim().toUpperCase();
    const severity = String(body.severity ?? "HIGH").trim().toUpperCase();
    const message = String(body.message ?? "").trim();
    const allowedTypes = [
      "SPEND_SPIKE",
      "PROVIDER_DOWNTIME",
      "ERROR_SPIKE",
      "DLQ_GROWTH",
      "BILLING_ANOMALY",
      "ESTIMATOR_SPIKE",
    ] as const;
    if (!allowedTypes.includes(type as (typeof allowedTypes)[number])) {
      throw new AppError(400, "Invalid alert type");
    }
    if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(severity)) {
      throw new AppError(400, "Invalid alert severity");
    }
    if (!message) throw new AppError(400, "message is required");

    const alert = await observabilityService.triggerAlert({
      type: type as
        | "SPEND_SPIKE"
        | "PROVIDER_DOWNTIME"
        | "ERROR_SPIKE"
        | "DLQ_GROWTH"
        | "BILLING_ANOMALY"
        | "ESTIMATOR_SPIKE",
      severity: severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      message,
      provider: typeof body.provider === "string" ? body.provider : undefined,
      model: typeof body.model === "string" ? body.model : undefined,
      details:
        body.details && typeof body.details === "object"
          ? (body.details as Record<string, unknown>)
          : {},
    });
    return sendSuccess(res, { alert }, "Alert triggered");
  } catch (error) {
    return next(error);
  }
};
