"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postAiThreadForward = exports.postAiThreadShare = exports.postAiThreadTurn = exports.getAiThread = exports.postAiThread = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const socket_1 = require("../../socket");
const chat_service_1 = require("../chat/chat.service");
const ai_thread_service_1 = require("./ai-thread.service");
const emitUnreadForRecipients = async (chatId, actorUserId) => {
    const participantUserIds = await chat_service_1.chatService.getChatParticipantUserIds(chatId);
    const recipients = participantUserIds.filter((participantUserId) => participantUserId !== actorUserId);
    await Promise.all(recipients.map(async (participantUserId) => {
        const unreadCount = await chat_service_1.chatService.getUnreadCountForChat(participantUserId, chatId);
        const summary = await chat_service_1.chatService.getUnreadSummary(participantUserId);
        (0, socket_1.emitUnreadUpdateToUser)(participantUserId, {
            chatId,
            unreadCount,
            totalUnread: summary.total,
            directUnread: summary.direct,
            groupUnread: summary.group,
            aiUnread: summary.ai,
            unreadCountDelta: 1,
            totalUnreadDelta: 1,
        });
    }));
};
const postAiThread = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = ai_thread_service_1.aiThreadService.parseCreateThreadBody(req.body);
        const data = await ai_thread_service_1.aiThreadService.createOrReuseThread({
            requesterId: req.user.id,
            chatId: body.chatId,
            targetMessageId: body.targetMessageId,
        });
        return (0, response_1.sendSuccess)(res, {
            threadId: data.threadId,
            thread: {
                id: data.thread.id,
                chatId: data.thread.chatId,
                requesterId: data.thread.requesterId,
                targetMessageId: data.thread.targetMessageId,
                title: data.thread.title,
                createdAt: data.thread.createdAt,
                updatedAt: data.thread.updatedAt,
            },
            turns: data.thread.turns.map((turn) => ({
                id: turn.id,
                threadId: turn.threadId,
                role: turn.role,
                content: turn.content,
                meta: turn.meta ?? null,
                createdAt: turn.createdAt.toISOString(),
            })),
        }, "AI thread ready");
    }
    catch (error) {
        return next(error);
    }
};
exports.postAiThread = postAiThread;
const getAiThread = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const threadId = ai_thread_service_1.aiThreadService.parseThreadId(req.params.threadId);
        const data = await ai_thread_service_1.aiThreadService.getThread({
            requesterId: req.user.id,
            threadId,
        });
        return (0, response_1.sendSuccess)(res, data);
    }
    catch (error) {
        return next(error);
    }
};
exports.getAiThread = getAiThread;
const postAiThreadTurn = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const threadId = ai_thread_service_1.aiThreadService.parseThreadId(req.params.threadId);
        const body = ai_thread_service_1.aiThreadService.parseCreateTurnBody(req.body);
        const data = await ai_thread_service_1.aiThreadService.createTurnAndEnqueue({
            requesterId: req.user.id,
            threadId,
            prompt: body.prompt,
            commandHint: body.commandHint,
            translateTo: body.translateTo,
        });
        (0, socket_1.emitAiTurnCreatedToUser)(req.user.id, {
            threadId: data.thread.id,
            turn: data.userTurn,
        });
        (0, socket_1.emitAiTurnCreatedToUser)(req.user.id, {
            threadId: data.thread.id,
            turn: data.aiTurnPlaceholder,
        });
        (0, socket_1.emitAiThreadUpdatedToUser)(req.user.id, {
            threadId: data.thread.id,
            updatedAt: new Date().toISOString(),
        });
        return (0, response_1.sendSuccess)(res, {
            userTurn: data.userTurn,
            aiTurnPlaceholder: data.aiTurnPlaceholder,
            jobId: data.jobId,
        }, "AI turn queued", 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.postAiThreadTurn = postAiThreadTurn;
const postAiThreadShare = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const threadId = ai_thread_service_1.aiThreadService.parseThreadId(req.params.threadId);
        const body = ai_thread_service_1.aiThreadService.parseShareBody(req.body);
        const data = await ai_thread_service_1.aiThreadService.shareAiTurnToThreadChat({
            requesterId: req.user.id,
            threadId,
            aiTurnId: body.aiTurnId,
        });
        (0, socket_1.emitNewMessage)(data.message);
        await emitUnreadForRecipients(data.thread.chatId, req.user.id);
        return (0, response_1.sendSuccess)(res, { message: data.message }, "AI answer shared", 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.postAiThreadShare = postAiThreadShare;
const postAiThreadForward = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const threadId = ai_thread_service_1.aiThreadService.parseThreadId(req.params.threadId);
        const body = ai_thread_service_1.aiThreadService.parseForwardBody(req.body);
        const data = await ai_thread_service_1.aiThreadService.forwardAiTurnToChat({
            requesterId: req.user.id,
            threadId,
            aiTurnId: body.aiTurnId,
            toChatId: body.toChatId,
        });
        (0, socket_1.emitNewMessage)(data.message);
        await emitUnreadForRecipients(body.toChatId, req.user.id);
        return (0, response_1.sendSuccess)(res, { message: data.message }, "AI answer forwarded", 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.postAiThreadForward = postAiThreadForward;
