import { NextFunction, Response } from "express";
import { MessageType } from "@prisma/client";
import { AppError } from "../../middlewares/errorHandler";
import { AuthRequest } from "../../types";
import { sendSuccess } from "../../utils/response";
import { chatService } from "../chat/chat.service";
import { groupService } from "../group/group.service";
import { messageService } from "./message.service";
import { privacyGuard } from "../privacy/privacy.guard";
import { aiMemoryService } from "../ai-memory/ai-memory.service";
import {
  emitMessageDeleted,
  emitMessageReactionUpdated,
  emitMessageRead,
  emitNewMessage,
  emitUnreadResetToUser,
  emitUnreadUpdateToUser,
} from "../../socket";

export const createMessage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const { chatId, content, mediaUrl, type, replyToId } = req.body as {
      chatId?: string;
      content?: string;
      mediaUrl?: string;
      type?: MessageType;
      replyToId?: string;
    };
    if (!chatId) throw new AppError(400, "chatId is required");

    const currentUserId = req.user.id;
    const message = await messageService.createMessage({
      userId: currentUserId,
      chatId,
      content,
      mediaUrl,
      type,
      replyToId,
    });

    emitNewMessage(message);

    const participantUserIds = await chatService.getChatParticipantUserIds(chatId);
    const recipients = participantUserIds.filter((participantUserId) => participantUserId !== currentUserId);

    await Promise.all(
      recipients.map(async (participantUserId) => {
        const unreadCount = await chatService.getUnreadCountForChat(participantUserId, chatId);
        const summary = await chatService.getUnreadSummary(participantUserId);

        emitUnreadUpdateToUser(participantUserId, {
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

    void aiMemoryService.enqueueAutoKnowledgeExtraction({
      userId: currentUserId,
      chatId,
      messageIds: [message.id],
    });

    return sendSuccess(res, { message }, "Message sent", 201);
  } catch (error) {
    return next(error);
  }
};

export const forwardMessages = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const { messageIds, targetChatIds } = req.body as {
      messageIds?: string[];
      targetChatIds?: string[];
    };

    const currentUserId = req.user.id;
    const messages = await messageService.forwardMessages({
      userId: currentUserId,
      messageIds: messageIds ?? [],
      targetChatIds: targetChatIds ?? [],
    });

    messages.forEach((message) => emitNewMessage(message));

    const uniqueTargetChatIds = Array.from(new Set(messages.map((message) => message.chatId)));
    await Promise.all(
      uniqueTargetChatIds.map(async (chatId) => {
        const participantUserIds = await chatService.getChatParticipantUserIds(chatId);
        const recipients = participantUserIds.filter(
          (participantUserId) => participantUserId !== currentUserId
        );

        await Promise.all(
          recipients.map(async (participantUserId) => {
            const unreadCount = await chatService.getUnreadCountForChat(participantUserId, chatId);
            const summary = await chatService.getUnreadSummary(participantUserId);

            const forwardedCount = messages.filter((item) => item.chatId === chatId).length;
            emitUnreadUpdateToUser(participantUserId, {
              chatId,
              unreadCount,
              totalUnread: summary.total,
              directUnread: summary.direct,
              groupUnread: summary.group,
              aiUnread: summary.ai,
              unreadCountDelta: forwardedCount,
              totalUnreadDelta: forwardedCount,
            });
          })
        );
      })
    );

    return sendSuccess(res, { messages }, "Messages forwarded", 201);
  } catch (error) {
    return next(error);
  }
};

export const getMessages = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const { chatId } = req.params;
    if (!chatId) throw new AppError(400, "chatId is required");

    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;

    const data = await messageService.getChatMessages({
      userId: req.user.id,
      chatId: String(chatId),
      cursor,
      limit,
    });

    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
};

export const markChatRead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const chatId = String(req.params.chatId);
    const result = await messageService.markChatRead(req.user.id, chatId);
    await chatService.markChatRead(req.user.id, chatId);
    emitUnreadResetToUser(req.user.id, { chatId, unreadCount: 0 });

    const canBroadcastRead = await privacyGuard.shouldBroadcastReadReceipts(req.user.id);
    if (canBroadcastRead) {
      emitMessageRead({ chatId, readerId: req.user.id });
    }

    return sendSuccess(res, result, "Messages marked as read");
  } catch (error) {
    return next(error);
  }
};

export const deleteMessage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const messageId = String(req.params.id);
    await messageService.deleteMessage(req.user.id, messageId);
    return sendSuccess(res, { ok: true }, "Message deleted");
  } catch (error) {
    return next(error);
  }
};

export const deleteMessages = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const { messageIds, scope } = req.body as {
      messageIds?: string[];
      scope?: "ME" | "EVERYONE";
    };

    if (!scope || (scope !== "ME" && scope !== "EVERYONE")) {
      throw new AppError(400, "scope must be ME or EVERYONE");
    }

    const result = await messageService.deleteMessages({
      userId: req.user.id,
      messageIds: messageIds ?? [],
      scope,
    });

    if (scope === "ME") {
      return sendSuccess(res, {
        scope: result.scope,
        successIds: result.deletedMessageIds,
        deletedMessageIds: result.deletedMessageIds,
        failed: result.failed,
      });
    }

    result.byChat.forEach((item) => {
      const firstDeletedAt =
        result.deletedMessages.find((message) => message.chatId === item.chatId)?.deletedAt ??
        new Date();
      emitMessageDeleted({
        chatId: item.chatId,
        messageIds: item.messageIds,
        deletedById: req.user!.id,
        deletedAt: firstDeletedAt.toISOString(),
      });
    });

    return sendSuccess(res, {
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
  } catch (error) {
    return next(error);
  }
};

export const getMessageReads = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const messageId = String(req.params.messageId);
    const reads = await groupService.getMessageReads(messageId, req.user.id);
    return sendSuccess(res, { reads });
  } catch (error) {
    return next(error);
  }
};

export const toggleMessageReaction = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const messageId = String(req.params.messageId ?? "");
    const emoji = String(req.body?.emoji ?? "").trim();
    if (!messageId) throw new AppError(400, "messageId is required");
    if (!emoji) throw new AppError(400, "emoji is required");

    const data = await messageService.toggleReaction({
      userId: req.user.id,
      messageId,
      emoji,
    });

    emitMessageReactionUpdated({
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

    return sendSuccess(res, {
      messageId: data.messageId,
      emoji: data.emoji,
      action: data.action,
      summary: data.summary,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMessageReactions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const messageId = String(req.params.messageId ?? "");
    if (!messageId) throw new AppError(400, "messageId is required");
    const data = await messageService.getReactions({
      userId: req.user.id,
      messageId,
    });
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
};
