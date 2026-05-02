"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatMedia = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const media_service_1 = require("./media.service");
const getChatMedia = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const chatId = String(req.params.chatId);
        const rawFilter = typeof req.query.filter === "string" ? req.query.filter : "THIS_CHAT";
        const filter = rawFilter === "ALL_MEDIA" ? "ALL_MEDIA" : "THIS_CHAT";
        const media = await media_service_1.mediaService.getChatMedia(req.user.id, chatId, filter);
        return (0, response_1.sendSuccess)(res, { media });
    }
    catch (error) {
        return next(error);
    }
};
exports.getChatMedia = getChatMedia;
