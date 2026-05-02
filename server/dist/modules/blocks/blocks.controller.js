"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBlock = exports.postBlock = exports.getBlocks = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const blocks_service_1 = require("./blocks.service");
const getBlocks = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const blocks = await blocks_service_1.blocksService.listBlocked(req.user.id);
        return (0, response_1.sendSuccess)(res, { blocks });
    }
    catch (error) {
        return next(error);
    }
};
exports.getBlocks = getBlocks;
const postBlock = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const blockedUser = await blocks_service_1.blocksService.blockUser(req.user.id, {
            userId: typeof req.body?.userId === "string" ? req.body.userId : undefined,
            username: typeof req.body?.username === "string" ? req.body.username : undefined,
        });
        return (0, response_1.sendSuccess)(res, { blockedUser }, "User blocked");
    }
    catch (error) {
        return next(error);
    }
};
exports.postBlock = postBlock;
const deleteBlock = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const userId = String(req.params.userId ?? "");
        const data = await blocks_service_1.blocksService.unblockUser(req.user.id, userId);
        return (0, response_1.sendSuccess)(res, data, "User unblocked");
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteBlock = deleteBlock;
