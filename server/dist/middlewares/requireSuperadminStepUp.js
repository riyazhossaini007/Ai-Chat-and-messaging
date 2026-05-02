"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSuperadminStepUp = void 0;
const errorHandler_1 = require("./errorHandler");
const rbac_service_1 = require("../modules/security/rbac.service");
const stepup_service_1 = require("../modules/security/stepup.service");
const security_service_1 = require("../modules/security/security.service");
const requireSuperadminStepUp = async (req, _res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const isSuperAdmin = await rbac_service_1.rbacService.userHasRole(req.user.id, "SUPERADMIN");
        if (!isSuperAdmin)
            throw new errorHandler_1.AppError(403, "SUPERADMIN required");
        const token = String(req.headers["x-admin-stepup-token"] ?? "").trim();
        const check = await stepup_service_1.stepUpService.validateStepUpToken({
            userId: req.user.id,
            token,
        });
        if (!check.valid) {
            await security_service_1.securityService.logSecurityEvent({
                userId: req.user.id,
                type: "ACCESS_DENIED",
                route: req.originalUrl,
                ip: req.ip,
                userAgent: req.headers["user-agent"],
                requestId: req.body?.requestId ?? undefined,
                details: { reason: "step_up_required_or_invalid" },
            });
            throw new errorHandler_1.AppError(403, "STEP_UP_REQUIRED");
        }
        return next();
    }
    catch (error) {
        return next(error);
    }
};
exports.requireSuperadminStepUp = requireSuperadminStepUp;
