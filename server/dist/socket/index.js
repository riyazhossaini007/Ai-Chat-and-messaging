"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeUserFromChatRoom = exports.emitAiThreadUpdatedToUser = exports.emitAiTurnUpdatedToUser = exports.emitAiTurnCreatedToUser = exports.emitUnreadResetToUser = exports.emitUnreadUpdateToUser = exports.emitMessageReactionUpdated = exports.emitMessageDeleted = exports.emitGroupMessageRead = exports.emitGroupMessageDelivered = exports.emitMessageRead = exports.emitMessageStatusUpdate = exports.emitGroupInviteUpdated = exports.emitGroupRoleUpdated = exports.emitGroupMemberLeft = exports.emitGroupMembersUpdated = exports.emitGroupUpdated = exports.emitGroupMessageNew = exports.emitNewMessage = exports.userRoom = exports.chatRoom = void 0;
const socket_server_1 = require("./socket.server");
__exportStar(require("./socket.server"), exports);
__exportStar(require("./types"), exports);
const chatRoom = (chatId) => `chat:${chatId}`;
exports.chatRoom = chatRoom;
const userRoom = (userId) => `user:${userId}`;
exports.userRoom = userRoom;
const mapMessage = (message) => ({
    id: message.id,
    chatId: message.chatId,
    groupId: message.groupId ?? null,
    senderId: message.senderId,
    sender: message.sender,
    content: message.content ?? message.text ?? null,
    decryptError: message.decryptError ?? false,
    mediaUrl: message.mediaUrl,
    type: message.type,
    kind: message.kind,
    systemEvent: message.systemEvent,
    systemActor: message.systemActor ?? null,
    deletedForEveryone: message.deletedForEveryone,
    deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
    deletedById: message.deletedById,
    replyToId: message.replyToId,
    replyTo: message.replyTo
        ? {
            id: message.replyTo.id,
            type: message.replyTo.type,
            content: message.replyTo.content,
            mediaUrl: message.replyTo.mediaUrl,
            deletedForEveryone: message.replyTo.deletedForEveryone,
            senderId: message.replyTo.senderId,
            createdAt: message.replyTo.createdAt.toISOString(),
            sender: message.replyTo.sender,
            decryptError: message.replyTo.decryptError ?? false,
        }
        : null,
    replyToPreview: message.replyToPreview ??
        (message.replyTo
            ? {
                id: message.replyTo.id,
                senderId: message.replyTo.senderId,
                senderUsername: message.replyTo.sender?.name ??
                    message.replyTo.sender?.username ??
                    "Member",
                textSnippet: message.replyTo.deletedForEveryone
                    ? "This message was deleted."
                    : message.replyTo.type === "IMAGE"
                        ? "Photo"
                        : message.replyTo.type === "VIDEO"
                            ? "Video"
                            : message.replyTo.type === "FILE"
                                ? message.replyTo.content ?? "Document"
                                : message.replyTo.content ?? "",
                mediaType: message.replyTo.type,
                isDeletedForEveryone: message.replyTo.deletedForEveryone,
                kind: "USER",
            }
            : null),
    isForwarded: message.isForwarded,
    forwardFromMessageId: message.forwardFromMessageId,
    forwardFromSenderId: message.forwardFromSenderId,
    createdAt: message.createdAt.toISOString(),
    status: message.status,
    readCount: message.readCount ?? 0,
    deliveredToAtLeastOne: message.deliveredToAtLeastOne ?? false,
    reactionSummary: message.reactionSummary ?? [],
});
const emitNewMessage = (message) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.chatRoom)(message.chatId)).emit("new_message", mapMessage(message));
};
exports.emitNewMessage = emitNewMessage;
const emitGroupMessageNew = (message) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.chatRoom)(message.chatId)).emit("group:message_new", mapMessage(message));
};
exports.emitGroupMessageNew = emitGroupMessageNew;
const emitGroupUpdated = (chatId, payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.chatRoom)(chatId)).emit("group:updated", payload);
};
exports.emitGroupUpdated = emitGroupUpdated;
const emitGroupMembersUpdated = (chatId, payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.chatRoom)(chatId)).emit("group:members_updated", payload);
};
exports.emitGroupMembersUpdated = emitGroupMembersUpdated;
const emitGroupMemberLeft = (chatId, payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.chatRoom)(chatId)).emit("group:member_left", payload);
};
exports.emitGroupMemberLeft = emitGroupMemberLeft;
const emitGroupRoleUpdated = (chatId, payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.chatRoom)(chatId)).emit("group:role_updated", payload);
};
exports.emitGroupRoleUpdated = emitGroupRoleUpdated;
const emitGroupInviteUpdated = (chatId, payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.chatRoom)(chatId)).emit("group:invite_updated", payload);
};
exports.emitGroupInviteUpdated = emitGroupInviteUpdated;
const emitMessageStatusUpdate = (payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.chatRoom)(payload.chatId)).emit("message_status_update", {
        chatId: payload.chatId,
        messageId: payload.messageId,
        status: payload.status,
    });
};
exports.emitMessageStatusUpdate = emitMessageStatusUpdate;
const emitMessageRead = (payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.chatRoom)(payload.chatId)).emit("message_read", payload);
};
exports.emitMessageRead = emitMessageRead;
const emitGroupMessageDelivered = (payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.userRoom)(payload.senderId)).emit("group:message_delivered", {
        messageId: payload.messageId,
        deliveredToAtLeastOne: payload.deliveredToAtLeastOne,
    });
};
exports.emitGroupMessageDelivered = emitGroupMessageDelivered;
const emitGroupMessageRead = (payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.chatRoom)(payload.chatId)).emit("group:message_read", payload);
};
exports.emitGroupMessageRead = emitGroupMessageRead;
const emitMessageDeleted = (payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.chatRoom)(payload.chatId)).emit("message_deleted", payload);
};
exports.emitMessageDeleted = emitMessageDeleted;
const emitMessageReactionUpdated = (payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.chatRoom)(payload.chatId)).emit("message_reaction_updated", payload);
};
exports.emitMessageReactionUpdated = emitMessageReactionUpdated;
const emitUnreadUpdateToUser = (userId, payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.userRoom)(userId)).emit("unread_update", payload);
};
exports.emitUnreadUpdateToUser = emitUnreadUpdateToUser;
const emitUnreadResetToUser = (userId, payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.userRoom)(userId)).emit("unread_reset", payload);
};
exports.emitUnreadResetToUser = emitUnreadResetToUser;
const emitAiTurnCreatedToUser = (userId, payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.userRoom)(userId)).emit("ai_turn_created", payload);
};
exports.emitAiTurnCreatedToUser = emitAiTurnCreatedToUser;
const emitAiTurnUpdatedToUser = (userId, payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.userRoom)(userId)).emit("ai_turn_updated", payload);
};
exports.emitAiTurnUpdatedToUser = emitAiTurnUpdatedToUser;
const emitAiThreadUpdatedToUser = (userId, payload) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    io.to((0, exports.userRoom)(userId)).emit("ai_thread_updated", payload);
};
exports.emitAiThreadUpdatedToUser = emitAiThreadUpdatedToUser;
const removeUserFromChatRoom = (chatId, userId) => {
    const io = (0, socket_server_1.getIO)();
    if (!io)
        return;
    const room = io.sockets.adapter.rooms.get((0, exports.chatRoom)(chatId));
    if (!room)
        return;
    room.forEach((socketId) => {
        const sock = io.sockets.sockets.get(socketId);
        if (!sock)
            return;
        if (sock.data?.user?.id === userId) {
            sock.leave((0, exports.chatRoom)(chatId));
        }
    });
};
exports.removeUserFromChatRoom = removeUserFromChatRoom;
