"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStorageUsage = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const storage_service_1 = require("./storage.service");
const getStorageUsage = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const usage = await storage_service_1.storageService.getStorageUsage(req.user.id);
        return (0, response_1.sendSuccess)(res, usage);
    }
    catch (error) {
        return next(error);
    }
};
exports.getStorageUsage = getStorageUsage;
