"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePaid = void 0;
const env_1 = require("../config/env");
const errorHandler_1 = require("../middlewares/errorHandler");
const call_service_1 = require("../modules/calls/call.service");
const requirePaid = async (req, _res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        if (!env_1.env.CALLING_ENABLED) {
            throw new errorHandler_1.AppError(403, "Calling feature is disabled", {
                code: "feature-disabled",
            });
        }
        const isPaid = await call_service_1.callService.isPaidUser(req.user.id);
        if (!isPaid) {
            throw new errorHandler_1.AppError(402, "Paid plan required for calling", {
                code: "paid-required",
            });
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.requirePaid = requirePaid;
