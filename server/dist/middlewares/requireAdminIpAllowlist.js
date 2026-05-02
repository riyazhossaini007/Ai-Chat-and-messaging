"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminIpAllowlist = void 0;
const env_1 = require("../config/env");
const errorHandler_1 = require("./errorHandler");
const security_service_1 = require("../modules/security/security.service");
const normalizeIp = (value) => value.replace("::ffff:", "").trim();
const requireAdminIpAllowlist = async (req, _res, next) => {
    try {
        if (!env_1.env.ADMIN_IP_ALLOWLIST_ENABLED)
            return next();
        const raw = env_1.env.ADMIN_IP_ALLOWLIST.split(",")
            .map((item) => normalizeIp(item))
            .filter(Boolean);
        const allow = new Set(raw);
        const ip = normalizeIp(req.ip ?? "");
        if (!allow.has(ip)) {
            await security_service_1.securityService.logSecurityEvent({
                userId: req.user?.id,
                type: "ACCESS_DENIED",
                route: req.originalUrl,
                ip: req.ip,
                userAgent: req.headers["user-agent"],
                requestId: req.body?.requestId ?? undefined,
                details: { reason: "admin_ip_allowlist", allowed: raw },
            });
            throw new errorHandler_1.AppError(403, "Forbidden from this network");
        }
        return next();
    }
    catch (error) {
        return next(error);
    }
};
exports.requireAdminIpAllowlist = requireAdminIpAllowlist;
