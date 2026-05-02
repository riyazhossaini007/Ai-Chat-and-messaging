"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAdminStepUp = exports.startAdminStepUp = exports.logout = exports.login = exports.verify = exports.register = void 0;
const auth_service_1 = require("./auth.service");
const response_1 = require("../../utils/response");
const errorHandler_1 = require("../../middlewares/errorHandler");
const register = async (req, res, next) => {
    try {
        const result = await auth_service_1.authService.register(req.body);
        return (0, response_1.sendSuccess)(res, result, "User registered. Verify OTP.", 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.register = register;
const verify = async (req, res, next) => {
    try {
        const result = await auth_service_1.authService.verify(req.body);
        return (0, response_1.sendSuccess)(res, result, "User verified");
    }
    catch (error) {
        return next(error);
    }
};
exports.verify = verify;
const login = async (req, res, next) => {
    try {
        const result = await auth_service_1.authService.login(req.body);
        return (0, response_1.sendSuccess)(res, result, "Logged in");
    }
    catch (error) {
        return next(error);
    }
};
exports.login = login;
const logout = async (_req, res, next) => {
    try {
        await auth_service_1.authService.logout();
        return (0, response_1.sendSuccess)(res, { ok: true }, "Logged out");
    }
    catch (error) {
        return next(error);
    }
};
exports.logout = logout;
const startAdminStepUp = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = req.body;
        if (!body.password)
            throw new errorHandler_1.AppError(400, "password is required");
        if (!body.reason)
            throw new errorHandler_1.AppError(400, "reason is required");
        const result = await auth_service_1.authService.startSuperadminStepUp({
            userId: req.user.id,
            password: body.password,
            reason: body.reason,
        });
        return (0, response_1.sendSuccess)(res, result, "Step-up challenge started");
    }
    catch (error) {
        return next(error);
    }
};
exports.startAdminStepUp = startAdminStepUp;
const verifyAdminStepUp = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = req.body;
        if (!body.challengeId)
            throw new errorHandler_1.AppError(400, "challengeId is required");
        if (!body.otp)
            throw new errorHandler_1.AppError(400, "otp is required");
        const result = await auth_service_1.authService.verifySuperadminStepUp({
            userId: req.user.id,
            challengeId: body.challengeId,
            otp: body.otp,
        });
        return (0, response_1.sendSuccess)(res, result, "Step-up verified");
    }
    catch (error) {
        return next(error);
    }
};
exports.verifyAdminStepUp = verifyAdminStepUp;
