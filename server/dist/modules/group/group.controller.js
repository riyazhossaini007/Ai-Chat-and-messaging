"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteGroup = exports.postGroupRead = exports.postGroupMessage = exports.getGroupMessagesAround = exports.getGroupMessages = exports.joinByInviteToken = exports.revokeInvite = exports.createInvite = exports.setAdminRole = exports.transferCreator = exports.leaveGroup = exports.removeMember = exports.addMembers = exports.patchRules = exports.patchGroup = exports.getGroupDetails = exports.getMyGroups = exports.createGroup = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const socket_1 = require("../../socket");
const response_1 = require("../../utils/response");
const chat_service_1 = require("../chat/chat.service");
const group_service_1 = require("./group.service");
const privacy_guard_1 = require("../privacy/privacy.guard");
const ai_memory_service_1 = require("../ai-memory/ai-memory.service");
const hasConnectedRecipientInChatRoom = (chatId, senderId) => {
    const io = (0, socket_1.getIO)();
    if (!io)
        return false;
    const roomMembers = io.sockets.adapter.rooms.get((0, socket_1.chatRoom)(chatId));
    if (!roomMembers || roomMembers.size === 0)
        return false;
    for (const socketId of roomMembers) {
        const memberSocket = io.sockets.sockets.get(socketId);
        if (!memberSocket)
            continue;
        if (memberSocket.data?.user?.id && memberSocket.data.user.id !== senderId) {
            return true;
        }
    }
    return false;
};
const emitUnreadForRecipients = async (chatId, actorUserId) => {
    const recipients = await chat_service_1.chatService.getChatParticipantUserIds(chatId);
    await Promise.all(recipients
        .filter((userId) => userId !== actorUserId)
        .map(async (userId) => {
        const unreadCount = await chat_service_1.chatService.getUnreadCountForChat(userId, chatId);
        const summary = await chat_service_1.chatService.getUnreadSummary(userId);
        (0, socket_1.emitUnreadUpdateToUser)(userId, {
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
const createGroup = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const { title, avatar, description, memberIds } = req.body;
        if (!title)
            throw new errorHandler_1.AppError(400, "title is required");
        const group = await group_service_1.groupService.createGroup(req.user.id, {
            title,
            avatar: avatar ?? null,
            description: description ?? null,
            memberIds: memberIds ?? [],
        });
        return (0, response_1.sendSuccess)(res, { group }, "Group created", 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createGroup = createGroup;
const getMyGroups = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groups = await group_service_1.groupService.getMyGroups(req.user.id);
        return (0, response_1.sendSuccess)(res, { groups });
    }
    catch (error) {
        return next(error);
    }
};
exports.getMyGroups = getMyGroups;
const getGroupDetails = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId);
        const group = await group_service_1.groupService.getGroupDetails(groupId, req.user.id);
        return (0, response_1.sendSuccess)(res, { group });
    }
    catch (error) {
        return next(error);
    }
};
exports.getGroupDetails = getGroupDetails;
const patchGroup = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId);
        const data = await group_service_1.groupService.updateGroup(groupId, req.user.id, req.body ?? {});
        const details = await group_service_1.groupService.getGroupDetails(groupId, req.user.id);
        (0, socket_1.emitGroupUpdated)(details.chatId, {
            groupId: details.id,
            title: details.title,
            avatar: details.avatar,
            description: details.description,
            rulesText: details.rulesText,
            memberCount: details.memberCount,
            updatedAt: details.updatedAt.toISOString(),
        });
        (0, socket_1.emitGroupMessageNew)(data.systemMessage);
        (0, socket_1.emitNewMessage)(data.systemMessage);
        await emitUnreadForRecipients(details.chatId, req.user.id);
        return (0, response_1.sendSuccess)(res, { group: data.group }, "Group updated");
    }
    catch (error) {
        return next(error);
    }
};
exports.patchGroup = patchGroup;
const patchRules = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId);
        const rulesText = String(req.body?.rulesText ?? "");
        const data = await group_service_1.groupService.updateRules(groupId, req.user.id, rulesText);
        const details = await group_service_1.groupService.getGroupDetails(groupId, req.user.id);
        (0, socket_1.emitGroupUpdated)(details.chatId, {
            groupId: details.id,
            title: details.title,
            avatar: details.avatar,
            description: details.description,
            rulesText: details.rulesText,
            memberCount: details.memberCount,
            updatedAt: details.updatedAt.toISOString(),
        });
        (0, socket_1.emitGroupMessageNew)(data.systemMessage);
        (0, socket_1.emitNewMessage)(data.systemMessage);
        await emitUnreadForRecipients(details.chatId, req.user.id);
        return (0, response_1.sendSuccess)(res, { group: data.group }, "Rules updated");
    }
    catch (error) {
        return next(error);
    }
};
exports.patchRules = patchRules;
const addMembers = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId);
        const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
        const data = await group_service_1.groupService.addMembers(groupId, req.user.id, userIds);
        const details = await group_service_1.groupService.getGroupDetails(groupId, req.user.id);
        (0, socket_1.emitGroupMembersUpdated)(details.chatId, {
            groupId: details.id,
            memberCount: details.memberCount,
            action: "ADD",
            userIds: data.addedUserIds,
            updatedAt: details.updatedAt.toISOString(),
        });
        data.systemMessages.forEach((message) => {
            (0, socket_1.emitGroupMessageNew)(message);
            (0, socket_1.emitNewMessage)(message);
        });
        await emitUnreadForRecipients(details.chatId, req.user.id);
        return (0, response_1.sendSuccess)(res, data, "Members added");
    }
    catch (error) {
        return next(error);
    }
};
exports.addMembers = addMembers;
const removeMember = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId);
        const userId = String(req.params.userId);
        const data = await group_service_1.groupService.removeMember(groupId, req.user.id, userId);
        const details = await group_service_1.groupService.getGroupDetails(groupId, req.user.id);
        (0, socket_1.emitGroupMembersUpdated)(details.chatId, {
            groupId: details.id,
            memberCount: details.memberCount,
            action: "REMOVE",
            userIds: [data.removedUserId],
            updatedAt: details.updatedAt.toISOString(),
        });
        (0, socket_1.emitGroupMemberLeft)(details.chatId, {
            groupId: details.id,
            userId: data.removedUserId,
            at: new Date().toISOString(),
        });
        (0, socket_1.emitGroupMessageNew)(data.systemMessage);
        (0, socket_1.emitNewMessage)(data.systemMessage);
        (0, socket_1.removeUserFromChatRoom)(details.chatId, data.removedUserId);
        await emitUnreadForRecipients(details.chatId, req.user.id);
        return (0, response_1.sendSuccess)(res, { ok: true }, "Member removed");
    }
    catch (error) {
        return next(error);
    }
};
exports.removeMember = removeMember;
const leaveGroup = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId);
        const newAdminUserId = req.body?.newAdminUserId
            ? String(req.body.newAdminUserId)
            : undefined;
        const details = await group_service_1.groupService.getGroupDetails(groupId, req.user.id);
        const data = await group_service_1.groupService.leaveGroup(groupId, req.user.id, { newAdminUserId });
        (0, socket_1.emitGroupMembersUpdated)(details.chatId, {
            groupId: details.id,
            memberCount: Math.max(0, details.memberCount - 1),
            action: "LEAVE",
            userIds: [req.user.id],
            updatedAt: new Date().toISOString(),
        });
        (0, socket_1.emitGroupMemberLeft)(details.chatId, {
            groupId: details.id,
            userId: req.user.id,
            at: new Date().toISOString(),
        });
        if (data.roleTransfer) {
            (0, socket_1.emitGroupRoleUpdated)(details.chatId, {
                groupId: details.id,
                userId: data.roleTransfer.newCreatorId,
                role: "CREATOR",
                previousRole: data.roleTransfer.newCreatorPreviousRole,
                at: new Date().toISOString(),
                isCreatorTransfer: true,
            });
            (0, socket_1.emitGroupRoleUpdated)(details.chatId, {
                groupId: details.id,
                userId: data.roleTransfer.previousCreatorId,
                role: "ADMIN",
                previousRole: "CREATOR",
                at: new Date().toISOString(),
                isCreatorTransfer: true,
            });
        }
        (0, socket_1.emitGroupMessageNew)(data.systemMessage);
        (0, socket_1.emitNewMessage)(data.systemMessage);
        (0, socket_1.removeUserFromChatRoom)(details.chatId, req.user.id);
        await emitUnreadForRecipients(details.chatId, req.user.id);
        return (0, response_1.sendSuccess)(res, { ok: true }, "Left group");
    }
    catch (error) {
        return next(error);
    }
};
exports.leaveGroup = leaveGroup;
const transferCreator = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId);
        const newCreatorUserId = String(req.body?.newCreatorUserId ?? "");
        if (!newCreatorUserId)
            throw new errorHandler_1.AppError(400, "newCreatorUserId is required");
        const details = await group_service_1.groupService.getGroupDetails(groupId, req.user.id);
        const data = await group_service_1.groupService.transferCreator(groupId, req.user.id, { newCreatorUserId });
        (0, socket_1.emitGroupRoleUpdated)(details.chatId, {
            groupId: details.id,
            userId: data.newCreatorId,
            role: "CREATOR",
            previousRole: data.newCreatorPreviousRole,
            at: new Date().toISOString(),
            isCreatorTransfer: true,
        });
        (0, socket_1.emitGroupRoleUpdated)(details.chatId, {
            groupId: details.id,
            userId: data.previousCreatorId,
            role: "ADMIN",
            previousRole: "CREATOR",
            at: new Date().toISOString(),
            isCreatorTransfer: true,
        });
        (0, socket_1.emitGroupMessageNew)(data.systemMessage);
        (0, socket_1.emitNewMessage)(data.systemMessage);
        await emitUnreadForRecipients(details.chatId, req.user.id);
        return (0, response_1.sendSuccess)(res, { ok: true, previousCreatorId: data.previousCreatorId, newCreatorId: data.newCreatorId }, "Creator transferred");
    }
    catch (error) {
        return next(error);
    }
};
exports.transferCreator = transferCreator;
const setAdminRole = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId);
        const userId = String(req.body?.userId ?? "");
        const action = String(req.body?.action ?? "");
        if (!userId || (action !== "PROMOTE" && action !== "DEMOTE")) {
            throw new errorHandler_1.AppError(400, "userId and action are required");
        }
        const data = await group_service_1.groupService.setAdminRole(groupId, req.user.id, { userId, action });
        const details = await group_service_1.groupService.getGroupDetails(groupId, req.user.id);
        (0, socket_1.emitGroupMembersUpdated)(details.chatId, {
            groupId: details.id,
            memberCount: details.memberCount,
            action: action === "PROMOTE" ? "PROMOTE" : "DEMOTE",
            userIds: [userId],
            updatedAt: details.updatedAt.toISOString(),
        });
        (0, socket_1.emitGroupMessageNew)(data.systemMessage);
        (0, socket_1.emitNewMessage)(data.systemMessage);
        await emitUnreadForRecipients(details.chatId, req.user.id);
        return (0, response_1.sendSuccess)(res, { role: data.role }, "Admin role updated");
    }
    catch (error) {
        return next(error);
    }
};
exports.setAdminRole = setAdminRole;
const createInvite = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId);
        const data = await group_service_1.groupService.issueInvite(groupId, req.user.id, {
            expiresAt: req.body?.expiresAt === null
                ? null
                : req.body?.expiresAt
                    ? String(req.body.expiresAt)
                    : undefined,
        });
        const details = await group_service_1.groupService.getGroupDetails(groupId, req.user.id);
        (0, socket_1.emitGroupInviteUpdated)(details.chatId, {
            groupId: details.id,
            token: data.invite.token,
            revokedAt: data.invite.revokedAt?.toISOString() ?? null,
            expiresAt: data.invite.expiresAt?.toISOString() ?? null,
            updatedAt: new Date().toISOString(),
        });
        return (0, response_1.sendSuccess)(res, {
            inviteUrl: data.inviteUrl,
            token: data.invite.token,
            expiresAt: data.invite.expiresAt,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.createInvite = createInvite;
const revokeInvite = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId);
        const data = await group_service_1.groupService.revokeInvite(groupId, req.user.id);
        const details = await group_service_1.groupService.getGroupDetails(groupId, req.user.id);
        (0, socket_1.emitGroupInviteUpdated)(details.chatId, {
            groupId: details.id,
            token: null,
            revokedAt: data.invite?.revokedAt?.toISOString() ?? new Date().toISOString(),
            expiresAt: data.invite?.expiresAt?.toISOString() ?? null,
            updatedAt: new Date().toISOString(),
        });
        return (0, response_1.sendSuccess)(res, data, "Invite revoked");
    }
    catch (error) {
        return next(error);
    }
};
exports.revokeInvite = revokeInvite;
const joinByInviteToken = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const token = String(req.params.token);
        const data = await group_service_1.groupService.joinByInviteToken(token, req.user.id);
        if (!data.alreadyMember) {
            const details = await group_service_1.groupService.getGroupDetails(data.groupId, req.user.id);
            (0, socket_1.emitGroupMembersUpdated)(details.chatId, {
                groupId: details.id,
                memberCount: details.memberCount,
                action: "JOIN",
                userIds: [req.user.id],
                updatedAt: new Date().toISOString(),
            });
        }
        if (data.message) {
            (0, socket_1.emitGroupMessageNew)(data.message);
            (0, socket_1.emitNewMessage)(data.message);
        }
        return (0, response_1.sendSuccess)(res, data, "Joined group");
    }
    catch (error) {
        return next(error);
    }
};
exports.joinByInviteToken = joinByInviteToken;
const getGroupMessages = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId);
        const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
        const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
        const data = await group_service_1.groupService.getGroupMessages(groupId, req.user.id, cursor, limit);
        return (0, response_1.sendSuccess)(res, data);
    }
    catch (error) {
        return next(error);
    }
};
exports.getGroupMessages = getGroupMessages;
const getGroupMessagesAround = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId);
        const messageId = String(req.params.messageId);
        const window = typeof req.query.window === "string" ? Number(req.query.window) : undefined;
        const data = await group_service_1.groupService.getGroupMessagesAround(groupId, req.user.id, messageId, window);
        return (0, response_1.sendSuccess)(res, data);
    }
    catch (error) {
        return next(error);
    }
};
exports.getGroupMessagesAround = getGroupMessagesAround;
const postGroupMessage = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId);
        const message = await group_service_1.groupService.createGroupMessage(groupId, req.user.id, {
            text: req.body?.text ? String(req.body.text) : undefined,
            mediaUrl: req.body?.mediaUrl ? String(req.body.mediaUrl) : undefined,
            mediaType: req.body?.mediaType,
            replyToId: req.body?.replyToId === null
                ? null
                : req.body?.replyToId
                    ? String(req.body.replyToId)
                    : undefined,
        });
        const details = await group_service_1.groupService.getGroupDetails(groupId, req.user.id);
        (0, socket_1.emitGroupMessageNew)(message);
        (0, socket_1.emitNewMessage)(message);
        if (hasConnectedRecipientInChatRoom(details.chatId, req.user.id)) {
            (0, socket_1.emitGroupMessageDelivered)({
                senderId: req.user.id,
                messageId: message.id,
                deliveredToAtLeastOne: true,
            });
        }
        await emitUnreadForRecipients(details.chatId, req.user.id);
        void ai_memory_service_1.aiMemoryService.enqueueAutoKnowledgeExtraction({
            userId: req.user.id,
            chatId: details.chatId,
            groupId,
            messageIds: [message.id],
        });
        return (0, response_1.sendSuccess)(res, { message }, "Message sent", 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.postGroupMessage = postGroupMessage;
const postGroupRead = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId);
        const messageIds = Array.isArray(req.body?.messageIds)
            ? req.body.messageIds.map((id) => String(id))
            : [];
        const events = await group_service_1.groupService.markGroupMessagesRead(groupId, req.user.id, messageIds);
        const details = await group_service_1.groupService.getGroupDetails(groupId, req.user.id);
        const canBroadcastRead = await privacy_guard_1.privacyGuard.shouldBroadcastReadReceipts(req.user.id);
        if (canBroadcastRead) {
            events.forEach((event) => {
                (0, socket_1.emitGroupMessageRead)({
                    chatId: details.chatId,
                    groupId,
                    messageId: event.messageId,
                    userId: req.user.id,
                    readAt: event.readAt.toISOString(),
                    readCount: event.readCount,
                });
            });
        }
        return (0, response_1.sendSuccess)(res, { items: events }, "Group messages marked as read");
    }
    catch (error) {
        return next(error);
    }
};
exports.postGroupRead = postGroupRead;
const deleteGroup = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId);
        await group_service_1.groupService.deleteGroup(groupId, req.user.id);
        return (0, response_1.sendSuccess)(res, { ok: true }, "Group deleted");
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteGroup = deleteGroup;
