"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocketEvents = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../config/prisma");
const chat_service_1 = require("../modules/chat/chat.service");
const privacy_guard_1 = require("../modules/privacy/privacy.guard");
const call_socket_1 = require("../modules/calls/call.socket");
const call_service_1 = require("../modules/calls/call.service");
const presence_store_1 = require("./presence.store");
const toSafeErrorMeta = (error) => {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
        };
    }
    return { message: "Unknown socket error" };
};
const RATE_LIMIT_WINDOW_MS = 5000;
const RATE_LIMIT_MAX_EVENTS = 40;
const rateState = new Map();
const chatRoom = (chatId) => `chat:${chatId}`;
const userRoom = (userId) => `user:${userId}`;
const isRateLimited = (socket, event) => {
    const now = Date.now();
    const key = `${socket.id}:${event}`;
    const current = rateState.get(key);
    if (!current || now - current.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateState.set(key, { count: 1, windowStart: now });
        return false;
    }
    current.count += 1;
    rateState.set(key, current);
    return current.count > RATE_LIMIT_MAX_EVENTS;
};
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const ensureParticipant = async (userId, chatId) => {
    await chat_service_1.chatService.assertParticipant(userId, chatId);
};
const registerTypingEvents = (socket) => {
    const userId = socket.data.user.id;
    socket.on("typing", async (payload) => {
        try {
            if (isRateLimited(socket, "typing"))
                return;
            if (!isNonEmptyString(payload?.chatId))
                return;
            const chatId = payload.chatId;
            await ensureParticipant(userId, chatId);
            socket.to(chatRoom(chatId)).emit("typing", { chatId, userId });
        }
        catch {
            socket.emit("socket_error", { code: "FORBIDDEN", message: "Invalid typing payload" });
        }
    });
    socket.on("stop_typing", async (payload) => {
        try {
            if (isRateLimited(socket, "stop_typing"))
                return;
            if (!isNonEmptyString(payload?.chatId))
                return;
            const chatId = payload.chatId;
            await ensureParticipant(userId, chatId);
            socket.to(chatRoom(chatId)).emit("stop_typing", { chatId, userId });
        }
        catch {
            socket.emit("socket_error", {
                code: "FORBIDDEN",
                message: "Invalid stop_typing payload",
            });
        }
    });
};
const registerJoinChatEvent = (socket) => {
    const userId = socket.data.user.id;
    socket.on("join_chat", async (payload) => {
        try {
            if (isRateLimited(socket, "join_chat"))
                return;
            if (!isNonEmptyString(payload?.chatId))
                return;
            const chatId = payload.chatId;
            await ensureParticipant(userId, chatId);
            socket.join(chatRoom(chatId));
        }
        catch {
            socket.emit("socket_error", { code: "FORBIDDEN", message: "Invalid join_chat payload" });
        }
    });
};
const registerDeliveredEvent = (io, socket) => {
    const userId = socket.data.user.id;
    socket.on("message_delivered", async (payload) => {
        try {
            if (isRateLimited(socket, "message_delivered"))
                return;
            if (!isNonEmptyString(payload?.chatId) || !isNonEmptyString(payload?.messageId)) {
                return;
            }
            const { chatId, messageId } = payload;
            await ensureParticipant(userId, chatId);
            const result = await prisma_1.prisma.message.updateMany({
                where: {
                    id: messageId,
                    chatId,
                    senderId: { not: userId },
                    status: client_1.MessageStatus.SENT,
                },
                data: { status: client_1.MessageStatus.DELIVERED },
            });
            if (result.count > 0) {
                io.to(chatRoom(chatId)).emit("message_status_update", {
                    chatId,
                    messageId,
                    status: client_1.MessageStatus.DELIVERED,
                });
            }
        }
        catch {
            socket.emit("socket_error", {
                code: "FORBIDDEN",
                message: "Invalid message_delivered payload",
            });
        }
    });
};
const registerMarkReadEvent = (io, socket) => {
    const userId = socket.data.user.id;
    socket.on("mark_read", async (payload) => {
        try {
            if (isRateLimited(socket, "mark_read"))
                return;
            if (!isNonEmptyString(payload?.chatId))
                return;
            const chatId = payload.chatId;
            await ensureParticipant(userId, chatId);
            await prisma_1.prisma.message.updateMany({
                where: {
                    chatId,
                    senderId: { not: userId },
                    status: { not: client_1.MessageStatus.READ },
                },
                data: { status: client_1.MessageStatus.READ },
            });
            await prisma_1.prisma.chatParticipant.update({
                where: { userId_chatId: { userId, chatId } },
                data: { lastReadAt: new Date() },
            });
            const canBroadcastRead = await privacy_guard_1.privacyGuard.shouldBroadcastReadReceipts(userId);
            if (canBroadcastRead) {
                io.to(chatRoom(chatId)).emit("message_read", { chatId, readerId: userId });
            }
            socket.emit("unread_reset", { chatId, unreadCount: 0 });
        }
        catch {
            socket.emit("socket_error", { code: "FORBIDDEN", message: "Invalid mark_read payload" });
        }
    });
};
const joinUserChatRooms = async (socket) => {
    const userId = socket.data.user.id;
    socket.join(userRoom(userId));
    const chats = await prisma_1.prisma.chatParticipant.findMany({
        where: { userId },
        select: { chatId: true },
    });
    chats.forEach(({ chatId }) => {
        socket.join(chatRoom(chatId));
    });
};
const registerSocketEvents = (io) => {
    io.on("connection", async (socket) => {
        const { id: userId } = socket.data.user;
        try {
            const wasOnline = (0, presence_store_1.isUserOnline)(userId);
            (0, presence_store_1.addUserSocket)(userId, socket.id);
            await joinUserChatRooms(socket);
            socket.emit("online_users", { userIds: (0, presence_store_1.getOnlineUserIds)() });
            if (!wasOnline) {
                socket.broadcast.emit("user_online", { userId });
            }
            registerTypingEvents(socket);
            registerJoinChatEvent(socket);
            registerDeliveredEvent(io, socket);
            registerMarkReadEvent(io, socket);
            (0, call_socket_1.registerCallSocketEvents)(io, socket);
            call_service_1.callService.onSocketConnect(userId);
            socket.on("disconnect", () => {
                void call_service_1.callService.onSocketDisconnect(userId);
                const remaining = (0, presence_store_1.removeUserSocket)(userId, socket.id);
                rateState.forEach((_value, key) => {
                    if (key.startsWith(`${socket.id}:`)) {
                        rateState.delete(key);
                    }
                });
                if (remaining === 0) {
                    socket.broadcast.emit("user_offline", { userId });
                }
            });
            socket.on("error", (error) => {
                console.error("Socket error", {
                    userId,
                    socketId: socket.id,
                    error: toSafeErrorMeta(error),
                });
            });
        }
        catch (error) {
            console.error("Socket connection bootstrap failed", {
                userId,
                socketId: socket.id,
                error: toSafeErrorMeta(error),
            });
            socket.disconnect(true);
        }
    });
};
exports.registerSocketEvents = registerSocketEvents;
