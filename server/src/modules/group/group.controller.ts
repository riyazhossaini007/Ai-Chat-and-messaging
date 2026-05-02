import { NextFunction, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import {
  emitGroupInviteUpdated,
  emitGroupMemberLeft,
  emitGroupMessageDelivered,
  emitGroupMembersUpdated,
  emitGroupMessageNew,
  emitGroupMessageRead,
  emitGroupRoleUpdated,
  emitGroupUpdated,
  emitNewMessage,
  removeUserFromChatRoom,
  emitUnreadUpdateToUser,
  getIO,
  chatRoom,
} from "../../socket";
import { AuthRequest } from "../../types";
import { sendSuccess } from "../../utils/response";
import { chatService } from "../chat/chat.service";
import { groupService } from "./group.service";
import { privacyGuard } from "../privacy/privacy.guard";
import { aiMemoryService } from "../ai-memory/ai-memory.service";

const hasConnectedRecipientInChatRoom = (chatId: string, senderId: string) => {
  const io = getIO();
  if (!io) return false;
  const roomMembers = io.sockets.adapter.rooms.get(chatRoom(chatId));
  if (!roomMembers || roomMembers.size === 0) return false;

  for (const socketId of roomMembers) {
    const memberSocket = io.sockets.sockets.get(socketId);
    if (!memberSocket) continue;
    if (memberSocket.data?.user?.id && memberSocket.data.user.id !== senderId) {
      return true;
    }
  }
  return false;
};

const emitUnreadForRecipients = async (chatId: string, actorUserId?: string) => {
  const recipients = await chatService.getChatParticipantUserIds(chatId);
  await Promise.all(
    recipients
      .filter((userId) => userId !== actorUserId)
      .map(async (userId) => {
        const unreadCount = await chatService.getUnreadCountForChat(userId, chatId);
        const summary = await chatService.getUnreadSummary(userId);
        emitUnreadUpdateToUser(userId, {
          chatId,
          unreadCount,
          totalUnread: summary.total,
          directUnread: summary.direct,
          groupUnread: summary.group,
          aiUnread: summary.ai,
          unreadCountDelta: 1,
          totalUnreadDelta: 1,
        });
      })
  );
};

export const createGroup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const { title, avatar, description, memberIds } = req.body as {
      title?: string;
      avatar?: string | null;
      description?: string | null;
      memberIds?: string[];
    };
    if (!title) throw new AppError(400, "title is required");

    const group = await groupService.createGroup(req.user.id, {
      title,
      avatar: avatar ?? null,
      description: description ?? null,
      memberIds: memberIds ?? [],
    });

    return sendSuccess(res, { group }, "Group created", 201);
  } catch (error) {
    return next(error);
  }
};

export const getMyGroups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groups = await groupService.getMyGroups(req.user.id);
    return sendSuccess(res, { groups });
  } catch (error) {
    return next(error);
  }
};

export const getGroupDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId);
    const group = await groupService.getGroupDetails(groupId, req.user.id);
    return sendSuccess(res, { group });
  } catch (error) {
    return next(error);
  }
};

export const patchGroup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId);
    const data = await groupService.updateGroup(groupId, req.user.id, req.body ?? {});
    const details = await groupService.getGroupDetails(groupId, req.user.id);

    emitGroupUpdated(details.chatId, {
      groupId: details.id,
      title: details.title,
      avatar: details.avatar,
      description: details.description,
      rulesText: details.rulesText,
      memberCount: details.memberCount,
      updatedAt: details.updatedAt.toISOString(),
    });
    emitGroupMessageNew(data.systemMessage);
    emitNewMessage(data.systemMessage);
    await emitUnreadForRecipients(details.chatId, req.user.id);

    return sendSuccess(res, { group: data.group }, "Group updated");
  } catch (error) {
    return next(error);
  }
};

export const patchRules = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId);
    const rulesText = String(req.body?.rulesText ?? "");
    const data = await groupService.updateRules(groupId, req.user.id, rulesText);
    const details = await groupService.getGroupDetails(groupId, req.user.id);

    emitGroupUpdated(details.chatId, {
      groupId: details.id,
      title: details.title,
      avatar: details.avatar,
      description: details.description,
      rulesText: details.rulesText,
      memberCount: details.memberCount,
      updatedAt: details.updatedAt.toISOString(),
    });
    emitGroupMessageNew(data.systemMessage);
    emitNewMessage(data.systemMessage);
    await emitUnreadForRecipients(details.chatId, req.user.id);

    return sendSuccess(res, { group: data.group }, "Rules updated");
  } catch (error) {
    return next(error);
  }
};

export const addMembers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId);
    const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
    const data = await groupService.addMembers(groupId, req.user.id, userIds);
    const details = await groupService.getGroupDetails(groupId, req.user.id);

    emitGroupMembersUpdated(details.chatId, {
      groupId: details.id,
      memberCount: details.memberCount,
      action: "ADD",
      userIds: data.addedUserIds,
      updatedAt: details.updatedAt.toISOString(),
    });
    data.systemMessages.forEach((message) => {
      emitGroupMessageNew(message);
      emitNewMessage(message);
    });
    await emitUnreadForRecipients(details.chatId, req.user.id);

    return sendSuccess(res, data, "Members added");
  } catch (error) {
    return next(error);
  }
};

export const removeMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId);
    const userId = String(req.params.userId);
    const data = await groupService.removeMember(groupId, req.user.id, userId);
    const details = await groupService.getGroupDetails(groupId, req.user.id);

    emitGroupMembersUpdated(details.chatId, {
      groupId: details.id,
      memberCount: details.memberCount,
      action: "REMOVE",
      userIds: [data.removedUserId],
      updatedAt: details.updatedAt.toISOString(),
    });
    emitGroupMemberLeft(details.chatId, {
      groupId: details.id,
      userId: data.removedUserId,
      at: new Date().toISOString(),
    });
    emitGroupMessageNew(data.systemMessage);
    emitNewMessage(data.systemMessage);
    removeUserFromChatRoom(details.chatId, data.removedUserId);
    await emitUnreadForRecipients(details.chatId, req.user.id);

    return sendSuccess(res, { ok: true }, "Member removed");
  } catch (error) {
    return next(error);
  }
};

export const leaveGroup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId);
    const newAdminUserId = req.body?.newAdminUserId
      ? String(req.body.newAdminUserId)
      : undefined;
    const details = await groupService.getGroupDetails(groupId, req.user.id);
    const data = await groupService.leaveGroup(groupId, req.user.id, { newAdminUserId });

    emitGroupMembersUpdated(details.chatId, {
      groupId: details.id,
      memberCount: Math.max(0, details.memberCount - 1),
      action: "LEAVE",
      userIds: [req.user.id],
      updatedAt: new Date().toISOString(),
    });
    emitGroupMemberLeft(details.chatId, {
      groupId: details.id,
      userId: req.user.id,
      at: new Date().toISOString(),
    });
    if (data.roleTransfer) {
      emitGroupRoleUpdated(details.chatId, {
        groupId: details.id,
        userId: data.roleTransfer.newCreatorId,
        role: "CREATOR",
        previousRole: data.roleTransfer.newCreatorPreviousRole,
        at: new Date().toISOString(),
        isCreatorTransfer: true,
      });
      emitGroupRoleUpdated(details.chatId, {
        groupId: details.id,
        userId: data.roleTransfer.previousCreatorId,
        role: "ADMIN",
        previousRole: "CREATOR",
        at: new Date().toISOString(),
        isCreatorTransfer: true,
      });
    }
    emitGroupMessageNew(data.systemMessage);
    emitNewMessage(data.systemMessage);
    removeUserFromChatRoom(details.chatId, req.user.id);
    await emitUnreadForRecipients(details.chatId, req.user.id);

    return sendSuccess(res, { ok: true }, "Left group");
  } catch (error) {
    return next(error);
  }
};

export const transferCreator = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId);
    const newCreatorUserId = String(req.body?.newCreatorUserId ?? "");
    if (!newCreatorUserId) throw new AppError(400, "newCreatorUserId is required");

    const details = await groupService.getGroupDetails(groupId, req.user.id);
    const data = await groupService.transferCreator(groupId, req.user.id, { newCreatorUserId });

    emitGroupRoleUpdated(details.chatId, {
      groupId: details.id,
      userId: data.newCreatorId,
      role: "CREATOR",
      previousRole: data.newCreatorPreviousRole,
      at: new Date().toISOString(),
      isCreatorTransfer: true,
    });
    emitGroupRoleUpdated(details.chatId, {
      groupId: details.id,
      userId: data.previousCreatorId,
      role: "ADMIN",
      previousRole: "CREATOR",
      at: new Date().toISOString(),
      isCreatorTransfer: true,
    });
    emitGroupMessageNew(data.systemMessage);
    emitNewMessage(data.systemMessage);
    await emitUnreadForRecipients(details.chatId, req.user.id);

    return sendSuccess(
      res,
      { ok: true, previousCreatorId: data.previousCreatorId, newCreatorId: data.newCreatorId },
      "Creator transferred"
    );
  } catch (error) {
    return next(error);
  }
};

export const setAdminRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId);
    const userId = String(req.body?.userId ?? "");
    const action = String(req.body?.action ?? "") as "PROMOTE" | "DEMOTE";
    if (!userId || (action !== "PROMOTE" && action !== "DEMOTE")) {
      throw new AppError(400, "userId and action are required");
    }

    const data = await groupService.setAdminRole(groupId, req.user.id, { userId, action });
    const details = await groupService.getGroupDetails(groupId, req.user.id);

    emitGroupMembersUpdated(details.chatId, {
      groupId: details.id,
      memberCount: details.memberCount,
      action: action === "PROMOTE" ? "PROMOTE" : "DEMOTE",
      userIds: [userId],
      updatedAt: details.updatedAt.toISOString(),
    });
    emitGroupMessageNew(data.systemMessage);
    emitNewMessage(data.systemMessage);
    await emitUnreadForRecipients(details.chatId, req.user.id);

    return sendSuccess(res, { role: data.role }, "Admin role updated");
  } catch (error) {
    return next(error);
  }
};

export const createInvite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId);
    const data = await groupService.issueInvite(groupId, req.user.id, {
      expiresAt:
        req.body?.expiresAt === null
          ? null
          : req.body?.expiresAt
          ? String(req.body.expiresAt)
          : undefined,
    });
    const details = await groupService.getGroupDetails(groupId, req.user.id);

    emitGroupInviteUpdated(details.chatId, {
      groupId: details.id,
      token: data.invite.token,
      revokedAt: data.invite.revokedAt?.toISOString() ?? null,
      expiresAt: data.invite.expiresAt?.toISOString() ?? null,
      updatedAt: new Date().toISOString(),
    });

    return sendSuccess(res, {
      inviteUrl: data.inviteUrl,
      token: data.invite.token,
      expiresAt: data.invite.expiresAt,
    });
  } catch (error) {
    return next(error);
  }
};

export const revokeInvite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId);
    const data = await groupService.revokeInvite(groupId, req.user.id);
    const details = await groupService.getGroupDetails(groupId, req.user.id);

    emitGroupInviteUpdated(details.chatId, {
      groupId: details.id,
      token: null,
      revokedAt: data.invite?.revokedAt?.toISOString() ?? new Date().toISOString(),
      expiresAt: data.invite?.expiresAt?.toISOString() ?? null,
      updatedAt: new Date().toISOString(),
    });

    return sendSuccess(res, data, "Invite revoked");
  } catch (error) {
    return next(error);
  }
};

export const joinByInviteToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const token = String(req.params.token);
    const data = await groupService.joinByInviteToken(token, req.user.id);
    if (!data.alreadyMember) {
      const details = await groupService.getGroupDetails(data.groupId, req.user.id);
      emitGroupMembersUpdated(details.chatId, {
        groupId: details.id,
        memberCount: details.memberCount,
        action: "JOIN",
        userIds: [req.user.id],
        updatedAt: new Date().toISOString(),
      });
    }
    if (data.message) {
      emitGroupMessageNew(data.message);
      emitNewMessage(data.message);
    }
    return sendSuccess(res, data, "Joined group");
  } catch (error) {
    return next(error);
  }
};

export const getGroupMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const data = await groupService.getGroupMessages(groupId, req.user.id, cursor, limit);
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
};

export const getGroupMessagesAround = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId);
    const messageId = String(req.params.messageId);
    const window =
      typeof req.query.window === "string" ? Number(req.query.window) : undefined;
    const data = await groupService.getGroupMessagesAround(
      groupId,
      req.user.id,
      messageId,
      window
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
};

export const postGroupMessage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId);
    const message = await groupService.createGroupMessage(groupId, req.user.id, {
      text: req.body?.text ? String(req.body.text) : undefined,
      mediaUrl: req.body?.mediaUrl ? String(req.body.mediaUrl) : undefined,
      mediaType: req.body?.mediaType,
      replyToId:
        req.body?.replyToId === null
          ? null
          : req.body?.replyToId
          ? String(req.body.replyToId)
          : undefined,
    });
    const details = await groupService.getGroupDetails(groupId, req.user.id);

    emitGroupMessageNew(message);
    emitNewMessage(message);
    if (hasConnectedRecipientInChatRoom(details.chatId, req.user.id)) {
      emitGroupMessageDelivered({
        senderId: req.user.id,
        messageId: message.id,
        deliveredToAtLeastOne: true,
      });
    }
    await emitUnreadForRecipients(details.chatId, req.user.id);
    void aiMemoryService.enqueueAutoKnowledgeExtraction({
      userId: req.user.id,
      chatId: details.chatId,
      groupId,
      messageIds: [message.id],
    });

    return sendSuccess(res, { message }, "Message sent", 201);
  } catch (error) {
    return next(error);
  }
};

export const postGroupRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId);
    const messageIds = Array.isArray(req.body?.messageIds)
      ? req.body.messageIds.map((id: unknown) => String(id))
      : [];

    const events = await groupService.markGroupMessagesRead(groupId, req.user.id, messageIds);
    const details = await groupService.getGroupDetails(groupId, req.user.id);
    const canBroadcastRead = await privacyGuard.shouldBroadcastReadReceipts(req.user.id);
    if (canBroadcastRead) {
      events.forEach((event) => {
        emitGroupMessageRead({
          chatId: details.chatId,
          groupId,
          messageId: event.messageId,
          userId: req.user!.id,
          readAt: event.readAt.toISOString(),
          readCount: event.readCount,
        });
      });
    }

    return sendSuccess(res, { items: events }, "Group messages marked as read");
  } catch (error) {
    return next(error);
  }
};

export const deleteGroup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId);
    await groupService.deleteGroup(groupId, req.user.id);
    return sendSuccess(res, { ok: true }, "Group deleted");
  } catch (error) {
    return next(error);
  }
};
