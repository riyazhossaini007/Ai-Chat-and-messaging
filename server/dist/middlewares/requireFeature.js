"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireFeature = void 0;
const featureGate_service_1 = require("../modules/admin/featureGate.service");
const errorHandler_1 = require("./errorHandler");
const requireFeature = (featureKey) => {
    return async (req, _res, next) => {
        try {
            if (!req.user)
                throw new errorHandler_1.AppError(401, "Unauthorized");
            const allowed = await featureGate_service_1.featureGateService.canUseFeature(req.user.id, featureKey);
            if (!allowed) {
                throw new errorHandler_1.AppError(402, "Feature access required", {
                    code: "feature-required",
                    featureKey,
                });
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.requireFeature = requireFeature;
