"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessageReactions = exports.toggleMessageReaction = exports.getMessageReads = exports.deleteMessages = exports.deleteMessage = exports.markChatRead = exports.getMessages = exports.forwardMessages = exports.createMessage = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const chat_service_1 = require("../chat/chat.service");
const group_service_1 = require("../group/group.service");
const message_service_1 = require("./message.service");
const privacy_guard_1 = require("../privacy/privacy.guard");
const ai_memory_service_1 = require("../ai-memory/ai-memory.service");
const socket_1 = require("../../socket");
const createMessage = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const { chatId, content, mediaUrl, type, replyToId } = req.body;
        if (!chatId)
            throw new errorHandler_1.AppError(400, "chatId is required");
        const currentUserId = req.user.id;
        const message = await message_service_1.messageService.createMessage({
            userId: currentUserId,
            chatId,
            content,
            mediaUrl,
            type,
            replyToId,
        });
        (0, socket_1.emitNewMessage)(message);
        const participantUserIds = await chat_service_1.chatService.getChatParticipantUserIds(chatId);
        const recipients = participantUserIds.filter((participantUserId) => participantUserId !== currentUserId);
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
        void ai_memory_service_1.aiMemoryService.enqueueAutoKnowledgeExtraction({
            userId: currentUserId,
            chatId,
            messageIds: [message.id],
        });
        return (0, response_1.sendSuccess)(res, { message }, "Message sent", 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createMessage = createMessage;
const forwardMessages = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const { messageIds, targetChatIds } = req.body;
        const currentUserId = req.user.id;
        const messages = await message_service_1.messageService.forwardMessages({
            userId: currentUserId,
            messageIds: messageIds ?? [],
            targetChatIds: targetChatIds ?? [],
        });
        messages.forEach((message) => (0, socket_1.emitNewMessage)(message));
        const uniqueTargetChatIds = Array.from(new Set(messages.map((message) => message.chatId)));
        await Promise.all(uniqueTargetChatIds.map(async (chatId) => {
            const participantUserIds = await chat_service_1.chatService.getChatParticipantUserIds(chatId);
            const recipients = participantUserIds.filter((participantUserId) => participantUserId !== currentUserId);
            await Promise.all(recipients.map(async (participantUserId) => {
                const unreadCount = await chat_service_1.chatService.getUnreadCountForChat(participantUserId, chatId);
                const summary = await chat_service_1.chatService.getUnreadSummary(participantUserId);
                const forwardedCount = messages.filter((item) => item.chatId === chatId).length;
                (0, socket_1.emitUnreadUpdateToUser)(participantUserId, {
                    chatId,
                    unreadCount,
                    totalUnread: summary.total,
                    directUnread: summary.direct,
                    groupUnread: summary.group,
                    aiUnread: summary.ai,
                    unreadCountDelta: forwardedCount,
                    totalUnreadDelta: forwardedCount,
                });
            }));
        }));
        return (0, response_1.sendSuccess)(res, { messages }, "Messages forwarded", 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.forwardMessages = forwardMessages;
const getMessages = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const { chatId } = req.params;
        if (!chatId)
            throw new errorHandler_1.AppError(400, "chatId is required");
        const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
        const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
        const data = await message_service_1.messageService.getChatMessages({
            userId: req.user.id,
            chatId: String(chatId),
            cursor,
            limit,
        });
        return (0, response_1.sendSuccess)(res, data);
    }
    catch (error) {
        return next(error);
    }
};
exports.getMessages = getMessages;
const markChatRead = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const chatId = String(req.params.chatId);
        const result = await message_service_1.messageService.markChatRead(req.user.id, chatId);
        await chat_service_1.chatService.markChatRead(req.user.id, chatId);
        (0, socket_1.emitUnreadResetToUser)(req.user.id, { chatId, unreadCount: 0 });
        const canBroadcastRead = await privacy_guard_1.privacyGuard.shouldBroadcastReadReceipts(req.user.id);
        if (canBroadcastRead) {
            (0, socket_1.emitMessageRead)({ chatId, readerId: req.user.id });
        }
        return (0, response_1.sendSuccess)(res, result, "Messages marked as read");
    }
    catch (error) {
        return next(error);
    }
};
exports.markChatRead = markChatRead;
const deleteMessage = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const messageId = String(req.params.id);
        await message_service_1.messageService.deleteMessage(req.user.id, messageId);
        return (0, response_1.sendSuccess)(res, { ok: true }, "Message deleted");
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteMessage = deleteMessage;
const deleteMessages = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const { messageIds, scope } = req.body;
        if (!scope || (scope !== "ME" && scope !== "EVERYONE")) {
            throw new errorHandler_1.AppError(400, "scope must be ME or EVERYONE");
        }
        const result = await message_service_1.messageService.deleteMessages({
            userId: req.user.id,
            messageIds: messageIds ?? [],
            scope,
        });
        if (scope === "ME") {
            return (0, response_1.sendSuccess)(res, {
                scope: result.scope,
                successIds: result.deletedMessageIds,
                deletedMessageIds: result.deletedMessageIds,
                failed: result.failed,
            });
        }
        result.byChat.forEach((item) => {
            const firstDeletedAt = result.deletedMessages.find((message) => message.chatId === item.chatId)?.deletedAt ??
                new Date();
            (0, socket_1.emitMessageDeleted)({
                chatId: item.chatId,
                messageIds: item.messageIds,
                deletedById: req.user.id,
                deletedAt: firstDeletedAt.toISOString(),
            });
        });
        return (0, response_1.sendSuccess)(res, {
            scope: result.scope,
            successIds: result.deletedMessages.map((message) => message.id),
            deletedMessages: result.deletedMessages.map((message) => ({
                id: message.id,
                chatId: message.chatId,
                deletedForEveryone: message.deletedForEveryone,
                deletedAt: message.deletedAt?.toISOString() ?? null,
                deletedById: message.deletedById,
            })),
            failed: result.failed,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteMessages = deleteMessages;
const getMessageReads = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const messageId = String(req.params.messageId);
        const reads = await group_service_1.groupService.getMessageReads(messageId, req.user.id);
        return (0, response_1.sendSuccess)(res, { reads });
    }
    catch (error) {
        return next(error);
    }
};
exports.getMessageReads = getMessageReads;
const toggleMessageReaction = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const messageId = String(req.params.messageId ?? "");
        const emoji = String(req.body?.emoji ?? "").trim();
        if (!messageId)
            throw new errorHandler_1.AppError(400, "messageId is required");
        if (!emoji)
            throw new errorHandler_1.AppError(400, "emoji is required");
        const data = await message_service_1.messageService.toggleReaction({
            userId: req.user.id,
            messageId,
            emoji,
        });
        (0, socket_1.emitMessageReactionUpdated)({
            messageId: data.messageId,
            chatId: data.chatId,
            groupId: data.groupId ?? null,
            chatType: data.chatType,
            summary: data.summary.map((item) => ({
                emoji: item.emoji,
                count: item.count,
            })),
            actorUserId: req.user.id,
            emoji: data.emoji,
            action: data.action,
        });
        return (0, response_1.sendSuccess)(res, {
            messageId: data.messageId,
            emoji: data.emoji,
            action: data.action,
            summary: data.summary,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.toggleMessageReaction = toggleMessageReaction;
const getMessageReactions = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const messageId = String(req.params.messageId ?? "");
        if (!messageId)
            throw new errorHandler_1.AppError(400, "messageId is required");
        const data = await message_service_1.messageService.getReactions({
            userId: req.user.id,
            messageId,
        });
        return (0, response_1.sendSuccess)(res, data);
    }
    catch (error) {
        return next(error);
    }
};
exports.getMessageReactions = getMessageReactions;
