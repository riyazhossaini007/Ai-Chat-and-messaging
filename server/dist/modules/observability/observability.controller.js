"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postOpsTriggerAlert = exports.postOpsAlertResolve = exports.postOpsAlertAcknowledge = exports.getOpsAlerts = exports.postOpsEvaluateAlerts = exports.postOpsRunRollup = exports.getOpsDailyDashboard = exports.getOpsLiveMetrics = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const observability_service_1 = require("./observability.service");
const getOpsLiveMetrics = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const hours = Number(req.query.hours ?? "1");
        const data = await observability_service_1.observabilityService.getLiveMetrics({ hours });
        return (0, response_1.sendSuccess)(res, data);
    }
    catch (error) {
        return next(error);
    }
};
exports.getOpsLiveMetrics = getOpsLiveMetrics;
const getOpsDailyDashboard = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const days = Number(req.query.days ?? "30");
        const data = await observability_service_1.observabilityService.getDailyDashboard({ days });
        return (0, response_1.sendSuccess)(res, data);
    }
    catch (error) {
        return next(error);
    }
};
exports.getOpsDailyDashboard = getOpsDailyDashboard;
const postOpsRunRollup = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const dateRaw = String(req.body?.date ?? "").trim();
        const date = dateRaw ? new Date(dateRaw) : undefined;
        const result = await observability_service_1.observabilityService.runDailyRollup({
            date: date && !Number.isNaN(date.getTime()) ? date : undefined,
        });
        return (0, response_1.sendSuccess)(res, result, "Daily rollup complete");
    }
    catch (error) {
        return next(error);
    }
};
exports.postOpsRunRollup = postOpsRunRollup;
const postOpsEvaluateAlerts = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const result = await observability_service_1.observabilityService.evaluateAlerts();
        return (0, response_1.sendSuccess)(res, result, "Alert evaluation complete");
    }
    catch (error) {
        return next(error);
    }
};
exports.postOpsEvaluateAlerts = postOpsEvaluateAlerts;
const getOpsAlerts = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const limit = Number(req.query.limit ?? "100");
        const statusRaw = String(req.query.status ?? "").trim().toUpperCase();
        const status = statusRaw === "OPEN" || statusRaw === "ACKNOWLEDGED" || statusRaw === "RESOLVED"
            ? statusRaw
            : undefined;
        const alerts = await observability_service_1.observabilityService.listAlerts({ limit, status });
        return (0, response_1.sendSuccess)(res, { alerts });
    }
    catch (error) {
        return next(error);
    }
};
exports.getOpsAlerts = getOpsAlerts;
const postOpsAlertAcknowledge = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const id = String(req.body?.id ?? "").trim();
        if (!id)
            throw new errorHandler_1.AppError(400, "id is required");
        const alert = await observability_service_1.observabilityService.acknowledgeAlert(id);
        return (0, response_1.sendSuccess)(res, { alert }, "Alert acknowledged");
    }
    catch (error) {
        return next(error);
    }
};
exports.postOpsAlertAcknowledge = postOpsAlertAcknowledge;
const postOpsAlertResolve = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const id = String(req.body?.id ?? "").trim();
        if (!id)
            throw new errorHandler_1.AppError(400, "id is required");
        const alert = await observability_service_1.observabilityService.resolveAlert(id);
        return (0, response_1.sendSuccess)(res, { alert }, "Alert resolved");
    }
    catch (error) {
        return next(error);
    }
};
exports.postOpsAlertResolve = postOpsAlertResolve;
const postOpsTriggerAlert = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = req.body;
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
        ];
        if (!allowedTypes.includes(type)) {
            throw new errorHandler_1.AppError(400, "Invalid alert type");
        }
        if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(severity)) {
            throw new errorHandler_1.AppError(400, "Invalid alert severity");
        }
        if (!message)
            throw new errorHandler_1.AppError(400, "message is required");
        const alert = await observability_service_1.observabilityService.triggerAlert({
            type: type,
            severity: severity,
            message,
            provider: typeof body.provider === "string" ? body.provider : undefined,
            model: typeof body.model === "string" ? body.model : undefined,
            details: body.details && typeof body.details === "object"
                ? body.details
                : {},
        });
        return (0, response_1.sendSuccess)(res, { alert }, "Alert triggered");
    }
    catch (error) {
        return next(error);
    }
};
exports.postOpsTriggerAlert = postOpsTriggerAlert;
