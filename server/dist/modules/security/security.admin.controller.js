"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoleAuditLogs = exports.revokeUserRole = exports.assignUserRole = exports.getRoleUsers = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const rbac_service_1 = require("./rbac.service");
const security_service_1 = require("./security.service");
const prisma_1 = require("../../config/prisma");
const parseRole = (value) => {
    const role = String(value ?? "").trim().toUpperCase();
    if (role === "USER" || role === "MODERATOR" || role === "ADMIN" || role === "SUPERADMIN") {
        return role;
    }
    throw new errorHandler_1.AppError(400, "Invalid role");
};
const getRoleUsers = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const query = typeof req.query.query === "string" ? req.query.query : undefined;
        const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
        const users = await rbac_service_1.rbacService.listUsersWithRoles({ query, limit });
        return (0, response_1.sendSuccess)(res, { users });
    }
    catch (error) {
        return next(error);
    }
};
exports.getRoleUsers = getRoleUsers;
const assignUserRole = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = req.body;
        const userId = String(body.userId ?? "").trim();
        if (!userId)
            throw new errorHandler_1.AppError(400, "userId is required");
        const role = parseRole(body.role);
        const reason = String(body.reason ?? "").trim();
        if (!reason)
            throw new errorHandler_1.AppError(400, "reason is required");
        const before = await rbac_service_1.rbacService.getUserRoles(userId);
        await rbac_service_1.rbacService.assignRole({ userId, role });
        const after = await rbac_service_1.rbacService.getUserRoles(userId);
        await security_service_1.securityService.createAdminActionAuditLog({
            actorUserId: req.user.id,
            targetUserId: userId,
            action: "ROLE_ASSIGN",
            reason,
            before,
            after,
            ip: req.ip,
            userAgent: req.headers["user-agent"],
            requestId: String(body.requestId ?? "").trim() || `role-${Date.now()}`,
        });
        return (0, response_1.sendSuccess)(res, { userId, before, after }, "Role assigned");
    }
    catch (error) {
        return next(error);
    }
};
exports.assignUserRole = assignUserRole;
const revokeUserRole = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = req.body;
        const userId = String(body.userId ?? "").trim();
        if (!userId)
            throw new errorHandler_1.AppError(400, "userId is required");
        const role = parseRole(body.role);
        const reason = String(body.reason ?? "").trim();
        if (!reason)
            throw new errorHandler_1.AppError(400, "reason is required");
        if (userId === req.user.id && role === "SUPERADMIN") {
            throw new errorHandler_1.AppError(400, "Cannot revoke your own SUPERADMIN role");
        }
        const before = await rbac_service_1.rbacService.getUserRoles(userId);
        await rbac_service_1.rbacService.revokeRole({ userId, role });
        const after = await rbac_service_1.rbacService.getUserRoles(userId);
        await security_service_1.securityService.createAdminActionAuditLog({
            actorUserId: req.user.id,
            targetUserId: userId,
            action: "ROLE_REVOKE",
            reason,
            before,
            after,
            ip: req.ip,
            userAgent: req.headers["user-agent"],
            requestId: String(body.requestId ?? "").trim() || `role-${Date.now()}`,
        });
        return (0, response_1.sendSuccess)(res, { userId, before, after }, "Role revoked");
    }
    catch (error) {
        return next(error);
    }
};
exports.revokeUserRole = revokeUserRole;
const getRoleAuditLogs = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 100;
        const rows = await prisma_1.prisma.adminActionAuditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: Math.max(1, Math.min(500, limit)),
        });
        return (0, response_1.sendSuccess)(res, { logs: rows });
    }
    catch (error) {
        return next(error);
    }
};
exports.getRoleAuditLogs = getRoleAuditLogs;
