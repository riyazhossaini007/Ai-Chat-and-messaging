"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMe = exports.patchMe = exports.getNearbyUsers = exports.getMe = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const user_service_1 = require("./user.service");
const getMe = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const user = await user_service_1.userService.getMe(req.user.id);
        return (0, response_1.sendSuccess)(res, { user });
    }
    catch (error) {
        return next(error);
    }
};
exports.getMe = getMe;
const getNearbyUsers = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const users = await user_service_1.userService.getNearbyUsers(req.user.id);
        return (0, response_1.sendSuccess)(res, { users });
    }
    catch (error) {
        return next(error);
    }
};
exports.getNearbyUsers = getNearbyUsers;
const patchMe = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const user = await user_service_1.userService.updateMe(req.user.id, req.body);
        return (0, response_1.sendSuccess)(res, { user }, "Profile updated");
    }
    catch (error) {
        return next(error);
    }
};
exports.patchMe = patchMe;
const deleteMe = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        await user_service_1.userService.deleteMe(req.user.id);
        return (0, response_1.sendSuccess)(res, { ok: true }, "Account deleted");
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteMe = deleteMe;
