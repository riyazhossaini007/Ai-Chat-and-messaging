"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shareChat = exports.deleteChat = exports.reorderChats = exports.unarchiveChat = exports.archiveChat = exports.togglePinChat = exports.getUnreadSummary = exports.getUnreadTotal = exports.markChatRead = exports.getChats = exports.createDirect = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const socket_1 = require("../../socket");
const response_1 = require("../../utils/response");
const chat_service_1 = require("./chat.service");
const createDirect = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const { userId } = req.body;
        if (!userId)
            throw new errorHandler_1.AppError(400, "userId is required");
        const chat = await chat_service_1.chatService.createDirect(req.user.id, userId);
        return (0, response_1.sendSuccess)(res, { chat }, "Direct chat ready", 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createDirect = createDirect;
const getChats = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const chats = await chat_service_1.chatService.getChats(req.user.id);
        return (0, response_1.sendSuccess)(res, { chats });
    }
    catch (error) {
        return next(error);
    }
};
exports.getChats = getChats;
const markChatRead = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const chatId = String(req.params.chatId);
        const data = await chat_service_1.chatService.markChatRead(req.user.id, chatId);
        (0, socket_1.emitUnreadResetToUser)(req.user.id, {
            chatId,
            unreadCount: 0,
        });
        return (0, response_1.sendSuccess)(res, data, "Chat marked as read");
    }
    catch (error) {
        return next(error);
    }
};
exports.markChatRead = markChatRead;
const getUnreadTotal = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const total = await chat_service_1.chatService.getTotalUnread(req.user.id);
        return (0, response_1.sendSuccess)(res, { total });
    }
    catch (error) {
        return next(error);
    }
};
exports.getUnreadTotal = getUnreadTotal;
const getUnreadSummary = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const summary = await chat_service_1.chatService.getUnreadSummary(req.user.id);
        return (0, response_1.sendSuccess)(res, summary);
    }
    catch (error) {
        return next(error);
    }
};
exports.getUnreadSummary = getUnreadSummary;
const togglePinChat = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const chatId = String(req.params.chatId);
        const data = await chat_service_1.chatService.togglePinChat(req.user.id, chatId);
        return (0, response_1.sendSuccess)(res, data, "Pin state updated");
    }
    catch (error) {
        return next(error);
    }
};
exports.togglePinChat = togglePinChat;
const archiveChat = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const chatId = String(req.params.chatId);
        const data = await chat_service_1.chatService.archiveChat(req.user.id, chatId);
        return (0, response_1.sendSuccess)(res, data, "Chat archived");
    }
    catch (error) {
        return next(error);
    }
};
exports.archiveChat = archiveChat;
const unarchiveChat = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const chatId = String(req.params.chatId);
        const data = await chat_service_1.chatService.unarchiveChat(req.user.id, chatId);
        return (0, response_1.sendSuccess)(res, data, "Chat unarchived");
    }
    catch (error) {
        return next(error);
    }
};
exports.unarchiveChat = unarchiveChat;
const reorderChats = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = Array.isArray(req.body)
            ? req.body
            : req.body?.orders;
        const orders = (body ?? [])
            .filter((item) => item && typeof item.chatId === "string")
            .map((item) => ({
            chatId: String(item.chatId),
            order: Number.isFinite(item.order) ? Number(item.order) : 0,
        }));
        const data = await chat_service_1.chatService.reorderChats(req.user.id, orders);
        return (0, response_1.sendSuccess)(res, data, "Chats reordered");
    }
    catch (error) {
        return next(error);
    }
};
exports.reorderChats = reorderChats;
const deleteChat = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const chatId = String(req.params.id);
        await chat_service_1.chatService.leaveChat(req.user.id, chatId);
        return (0, response_1.sendSuccess)(res, { ok: true }, "Left chat");
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteChat = deleteChat;
const shareChat = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const chatId = String(req.params.id);
        const data = await chat_service_1.chatService.shareChat(req.user.id, chatId);
        return (0, response_1.sendSuccess)(res, data);
    }
    catch (error) {
        return next(error);
    }
};
exports.shareChat = shareChat;
