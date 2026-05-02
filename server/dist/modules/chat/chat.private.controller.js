"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrGetPrivateChat = void 0;
const prisma_1 = require("../../config/prisma");
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const chat_service_1 = require("./chat.service");
const createOrGetPrivateChat = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = req.body;
        let targetUserId = body.userId?.trim();
        if (!targetUserId && body.username) {
            const normalizedUsername = body.username.replace(/^@/, "").trim();
            const user = await prisma_1.prisma.user.findUnique({
                where: { username: normalizedUsername },
                select: { id: true },
            });
            if (!user)
                throw new errorHandler_1.AppError(404, "User not found");
            targetUserId = user.id;
        }
        if (!targetUserId) {
            throw new errorHandler_1.AppError(400, "userId or username is required");
        }
        const chat = await chat_service_1.chatService.createDirect(req.user.id, targetUserId);
        return (0, response_1.sendSuccess)(res, { chat }, "Private chat ready");
    }
    catch (error) {
        return next(error);
    }
};
exports.createOrGetPrivateChat = createOrGetPrivateChat;
