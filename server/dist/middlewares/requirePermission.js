"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = void 0;
const errorHandler_1 = require("./errorHandler");
const rbac_service_1 = require("../modules/security/rbac.service");
const security_service_1 = require("../modules/security/security.service");
const requirePermission = (permissionKey) => {
    return async (req, _res, next) => {
        try {
            if (!req.user)
                throw new errorHandler_1.AppError(401, "Unauthorized");
            const allowed = await rbac_service_1.rbacService.userHasPermission(req.user.id, permissionKey);
            if (!allowed) {
                await security_service_1.securityService.logSecurityEvent({
                    userId: req.user.id,
                    type: "ACCESS_DENIED",
                    route: req.originalUrl,
                    ip: req.ip,
                    userAgent: req.headers["user-agent"],
                    requestId: req.body?.requestId ?? undefined,
                    details: { permissionKey },
                });
                throw new errorHandler_1.AppError(403, "Forbidden");
            }
            return next();
        }
        catch (error) {
            return next(error);
        }
    };
};
exports.requirePermission = requirePermission;
