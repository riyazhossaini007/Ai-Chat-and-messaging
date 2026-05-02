"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postAvatarRequest = exports.patchSettings = exports.getSettings = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const settings_service_1 = require("./settings.service");
const getSettings = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const settings = await settings_service_1.settingsService.getOrCreateSettings(req.user.id);
        return (0, response_1.sendSuccess)(res, { settings });
    }
    catch (error) {
        return next(error);
    }
};
exports.getSettings = getSettings;
const patchSettings = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const settings = await settings_service_1.settingsService.updateSettings(req.user.id, req.body);
        return (0, response_1.sendSuccess)(res, { settings }, "Settings updated");
    }
    catch (error) {
        return next(error);
    }
};
exports.patchSettings = patchSettings;
const postAvatarRequest = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const result = await settings_service_1.settingsService.createAvatarRequest(req.user.id, req.body);
        return (0, response_1.sendSuccess)(res, result, "Avatar request submitted", 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.postAvatarRequest = postAvatarRequest;
