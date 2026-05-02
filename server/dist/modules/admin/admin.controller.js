"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminAuditLogs = exports.getAdminHealth = exports.getAdminCallStats = exports.getAdminCallDetail = exports.getAdminCalls = exports.deleteAdminGroup = exports.patchAdminGroupFreeze = exports.getAdminGroupDetail = exports.getAdminGroups = exports.postAdminRemoveMessage = exports.postAdminBanUser = exports.patchAdminReportStatus = exports.getAdminReportDetail = exports.getAdminReports = exports.getAdminAiTopUsers = exports.getAdminAiUsage = exports.patchAdminUserNote = exports.patchAdminUserStatus = exports.patchAdminUserRole = exports.getAdminUserDetail = exports.getAdminUsers = exports.postAdminRevokeEntitlement = exports.postAdminGrantEntitlement = exports.getAdminEntitlements = exports.getAdminOverviewStats = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const admin_service_1 = require("./admin.service");
const admin_validation_1 = require("./admin.validation");
const getActor = (req) => {
    if (!req.user)
        throw new errorHandler_1.AppError(401, "Unauthorized");
    return req.user;
};
const getAdminOverviewStats = async (req, res, next) => {
    try {
        const range = (0, admin_validation_1.parseRange)(req.query, 7);
        const data = await admin_service_1.adminService.getOverviewStats(range);
        return (0, response_1.sendSuccess)(res, data);
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminOverviewStats = getAdminOverviewStats;
const getAdminEntitlements = async (req, res, next) => {
    try {
        const userId = (0, admin_validation_1.parseString)(req.query.userId, "userId");
        const items = await admin_service_1.adminService.listEntitlements(userId);
        return (0, response_1.sendSuccess)(res, { items });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminEntitlements = getAdminEntitlements;
const postAdminGrantEntitlement = async (req, res, next) => {
    try {
        const actor = getActor(req);
        const userId = (0, admin_validation_1.parseString)(req.body?.userId, "userId");
        const featureKey = (0, admin_validation_1.ensureEnum)(req.body?.featureKey, "featureKey", [
            "PRO_ACCESS",
            "AI_UNLIMITED",
            "CALLING",
            "GROUP_CALLING",
            "NO_ADS",
        ]);
        const expiresAt = req.body?.expiresAt ? new Date(String(req.body.expiresAt)) : undefined;
        const reason = (0, admin_validation_1.parseString)(req.body?.reason, "reason", { optional: true, max: 500 });
        const item = await admin_service_1.adminService.grantEntitlement({
            actorUserId: actor.id,
            userId,
            featureKey,
            expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : undefined,
            reason,
            reqMeta: { req },
        });
        return (0, response_1.sendSuccess)(res, { entitlement: item }, "Entitlement granted", 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.postAdminGrantEntitlement = postAdminGrantEntitlement;
const postAdminRevokeEntitlement = async (req, res, next) => {
    try {
        const actor = getActor(req);
        const entitlementId = (0, admin_validation_1.parseString)(req.body?.entitlementId, "entitlementId");
        const reason = (0, admin_validation_1.parseString)(req.body?.reason, "reason", { optional: true, max: 500 });
        const item = await admin_service_1.adminService.revokeEntitlement({ actorUserId: actor.id, entitlementId, reason, req });
        return (0, response_1.sendSuccess)(res, { entitlement: item }, "Entitlement revoked");
    }
    catch (error) {
        return next(error);
    }
};
exports.postAdminRevokeEntitlement = postAdminRevokeEntitlement;
const getAdminUsers = async (req, res, next) => {
    try {
        const data = await admin_service_1.adminService.listUsers(req.query);
        return (0, response_1.sendSuccess)(res, data);
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminUsers = getAdminUsers;
const getAdminUserDetail = async (req, res, next) => {
    try {
        const data = await admin_service_1.adminService.getUserDetail(String(req.params.id));
        return (0, response_1.sendSuccess)(res, { user: data });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminUserDetail = getAdminUserDetail;
const patchAdminUserRole = async (req, res, next) => {
    try {
        const actor = getActor(req);
        const role = (0, admin_validation_1.ensureEnum)(req.body?.role, "role", ["USER", "MODERATOR", "ADMIN", "SUPERADMIN"]);
        const data = await admin_service_1.adminService.patchUserRole({ actorUserId: actor.id, userId: String(req.params.id), role, req });
        return (0, response_1.sendSuccess)(res, data, "User role updated");
    }
    catch (error) {
        return next(error);
    }
};
exports.patchAdminUserRole = patchAdminUserRole;
const patchAdminUserStatus = async (req, res, next) => {
    try {
        const actor = getActor(req);
        const status = (0, admin_validation_1.ensureEnum)(req.body?.status, "status", ["ACTIVE", "BANNED", "DELETED"]);
        if (status === "DELETED" && actor.role !== "ADMIN" && actor.role !== "SUPERADMIN") {
            throw new errorHandler_1.AppError(403, "Only admin can set DELETED status");
        }
        const reason = (0, admin_validation_1.parseString)(req.body?.reason, "reason", { optional: true, max: 1000 });
        const data = await admin_service_1.adminService.patchUserStatus({
            actorUserId: actor.id,
            userId: String(req.params.id),
            status,
            reason,
            req,
        });
        return (0, response_1.sendSuccess)(res, data, "User status updated");
    }
    catch (error) {
        return next(error);
    }
};
exports.patchAdminUserStatus = patchAdminUserStatus;
const patchAdminUserNote = async (req, res, next) => {
    try {
        const actor = getActor(req);
        const note = req.body?.note === null ? null : (0, admin_validation_1.parseString)(req.body?.note, "note", { optional: true, max: 2000 }) ?? null;
        const data = await admin_service_1.adminService.patchUserNote({ actorUserId: actor.id, userId: String(req.params.id), note, req });
        return (0, response_1.sendSuccess)(res, data, "User note updated");
    }
    catch (error) {
        return next(error);
    }
};
exports.patchAdminUserNote = patchAdminUserNote;
const getAdminAiUsage = async (req, res, next) => {
    try {
        const range = (0, admin_validation_1.parseRange)(req.query, 7);
        const data = await admin_service_1.adminService.listAiUsage({
            ...range,
            userId: typeof req.query.userId === "string" ? req.query.userId : undefined,
            provider: typeof req.query.provider === "string" ? req.query.provider : undefined,
            status: typeof req.query.status === "string" ? req.query.status : undefined,
        });
        return (0, response_1.sendSuccess)(res, data);
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminAiUsage = getAdminAiUsage;
const getAdminAiTopUsers = async (req, res, next) => {
    try {
        const range = (0, admin_validation_1.parseRange)(req.query, 7);
        const metric = (0, admin_validation_1.ensureEnum)(req.query.metric ?? "requests", "metric", ["requests", "tokens"]);
        const items = await admin_service_1.adminService.getTopAiUsers({ ...range, metric });
        return (0, response_1.sendSuccess)(res, { items });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminAiTopUsers = getAdminAiTopUsers;
const getAdminReports = async (req, res, next) => {
    try {
        const items = await admin_service_1.adminService.listReports(req.query);
        return (0, response_1.sendSuccess)(res, { items });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminReports = getAdminReports;
const getAdminReportDetail = async (req, res, next) => {
    try {
        const report = await admin_service_1.adminService.getReport(String(req.params.id));
        return (0, response_1.sendSuccess)(res, { report });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminReportDetail = getAdminReportDetail;
const patchAdminReportStatus = async (req, res, next) => {
    try {
        const actor = getActor(req);
        const status = (0, admin_validation_1.ensureEnum)(req.body?.status, "status", ["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"]);
        const resolutionNote = (0, admin_validation_1.parseString)(req.body?.resolutionNote, "resolutionNote", { optional: true, max: 2000 });
        const report = await admin_service_1.adminService.patchReportStatus({
            actorUserId: actor.id,
            id: String(req.params.id),
            status,
            resolutionNote,
            req,
        });
        return (0, response_1.sendSuccess)(res, { report }, "Report updated");
    }
    catch (error) {
        return next(error);
    }
};
exports.patchAdminReportStatus = patchAdminReportStatus;
const postAdminBanUser = async (req, res, next) => {
    try {
        const actor = getActor(req);
        const userId = (0, admin_validation_1.parseString)(req.body?.userId, "userId");
        const reason = (0, admin_validation_1.parseString)(req.body?.reason, "reason", { max: 1000 });
        const user = await admin_service_1.adminService.moderationBanUser({ actorUserId: actor.id, userId, reason, req });
        return (0, response_1.sendSuccess)(res, { user }, "User banned");
    }
    catch (error) {
        return next(error);
    }
};
exports.postAdminBanUser = postAdminBanUser;
const postAdminRemoveMessage = async (req, res, next) => {
    try {
        const actor = getActor(req);
        const messageId = (0, admin_validation_1.parseString)(req.body?.messageId, "messageId");
        const reason = (0, admin_validation_1.parseString)(req.body?.reason, "reason", { max: 1000 });
        const message = await admin_service_1.adminService.moderationRemoveMessage({ actorUserId: actor.id, messageId, reason, req });
        return (0, response_1.sendSuccess)(res, { message }, "Message removed");
    }
    catch (error) {
        return next(error);
    }
};
exports.postAdminRemoveMessage = postAdminRemoveMessage;
const getAdminGroups = async (req, res, next) => {
    try {
        const items = await admin_service_1.adminService.listGroups(req.query);
        return (0, response_1.sendSuccess)(res, { items });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminGroups = getAdminGroups;
const getAdminGroupDetail = async (req, res, next) => {
    try {
        const group = await admin_service_1.adminService.getGroupDetail(String(req.params.id));
        return (0, response_1.sendSuccess)(res, { group });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminGroupDetail = getAdminGroupDetail;
const patchAdminGroupFreeze = async (req, res, next) => {
    try {
        const actor = getActor(req);
        const freeze = (0, admin_validation_1.parseBoolean)(req.body?.freeze, "freeze");
        const reason = (0, admin_validation_1.parseString)(req.body?.reason, "reason", { optional: true, max: 1000 });
        const group = await admin_service_1.adminService.freezeGroup({ actorUserId: actor.id, groupId: String(req.params.id), freeze, reason, req });
        return (0, response_1.sendSuccess)(res, { group }, freeze ? "Group frozen" : "Group unfrozen");
    }
    catch (error) {
        return next(error);
    }
};
exports.patchAdminGroupFreeze = patchAdminGroupFreeze;
const deleteAdminGroup = async (req, res, next) => {
    try {
        const actor = getActor(req);
        const group = await admin_service_1.adminService.softDeleteGroup({ actorUserId: actor.id, groupId: String(req.params.id), req });
        return (0, response_1.sendSuccess)(res, { group }, "Group deleted");
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteAdminGroup = deleteAdminGroup;
const getAdminCalls = async (req, res, next) => {
    try {
        const items = await admin_service_1.adminService.listCalls(req.query);
        return (0, response_1.sendSuccess)(res, { items });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminCalls = getAdminCalls;
const getAdminCallDetail = async (req, res, next) => {
    try {
        const call = await admin_service_1.adminService.getCallDetail(String(req.params.id));
        return (0, response_1.sendSuccess)(res, { call });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminCallDetail = getAdminCallDetail;
const getAdminCallStats = async (req, res, next) => {
    try {
        const range = (0, admin_validation_1.parseRange)(req.query, 7);
        const data = await admin_service_1.adminService.getCallStats(range);
        return (0, response_1.sendSuccess)(res, data);
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminCallStats = getAdminCallStats;
const getAdminHealth = async (_req, res, next) => {
    try {
        const checks = await admin_service_1.adminService.getHealth();
        return (0, response_1.sendSuccess)(res, checks);
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminHealth = getAdminHealth;
const getAdminAuditLogs = async (req, res, next) => {
    try {
        const items = await admin_service_1.adminService.listAuditLogs(req.query);
        return (0, response_1.sendSuccess)(res, { items });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAdminAuditLogs = getAdminAuditLogs;
