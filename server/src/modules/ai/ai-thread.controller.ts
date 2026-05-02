import { NextFunction, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { AuthRequest } from "../../types";
import { sendSuccess } from "../../utils/response";
import {
  emitAiThreadUpdatedToUser,
  emitAiTurnCreatedToUser,
  emitNewMessage,
  emitUnreadUpdateToUser,
} from "../../socket";
import { chatService } from "../chat/chat.service";
import { aiThreadService } from "./ai-thread.service";

const emitUnreadForRecipients = async (chatId: string, actorUserId: string) => {
  const participantUserIds = await chatService.getChatParticipantUserIds(chatId);
  const recipients = participantUserIds.filter((participantUserId) => participantUserId !== actorUserId);
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
};

export const postAiThread = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = aiThreadService.parseCreateThreadBody(req.body);
    const data = await aiThreadService.createOrReuseThread({
      requesterId: req.user.id,
      chatId: body.chatId,
      targetMessageId: body.targetMessageId,
    });
    return sendSuccess(
      res,
      {
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
        turns: data.thread.turns.map((turn: any) => ({
          id: turn.id,
          threadId: turn.threadId,
          role: turn.role,
          content: turn.content,
          meta: turn.meta ?? null,
          createdAt: turn.createdAt.toISOString(),
        })),
      },
      "AI thread ready"
    );
  } catch (error) {
    return next(error);
  }
};

export const getAiThread = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const threadId = aiThreadService.parseThreadId(req.params.threadId);
    const data = await aiThreadService.getThread({
      requesterId: req.user.id,
      threadId,
    });
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
};

export const postAiThreadTurn = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const threadId = aiThreadService.parseThreadId(req.params.threadId);
    const body = aiThreadService.parseCreateTurnBody(req.body);
    const data = await aiThreadService.createTurnAndEnqueue({
      requesterId: req.user.id,
      threadId,
      prompt: body.prompt,
      commandHint: body.commandHint,
      translateTo: body.translateTo,
    });

    emitAiTurnCreatedToUser(req.user.id, {
      threadId: data.thread.id,
      turn: data.userTurn,
    });
    emitAiTurnCreatedToUser(req.user.id, {
      threadId: data.thread.id,
      turn: data.aiTurnPlaceholder,
    });
    emitAiThreadUpdatedToUser(req.user.id, {
      threadId: data.thread.id,
      updatedAt: new Date().toISOString(),
    });

    return sendSuccess(
      res,
      {
        userTurn: data.userTurn,
        aiTurnPlaceholder: data.aiTurnPlaceholder,
        jobId: data.jobId,
      },
      "AI turn queued",
      201
    );
  } catch (error) {
    return next(error);
  }
};

export const postAiThreadShare = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const threadId = aiThreadService.parseThreadId(req.params.threadId);
    const body = aiThreadService.parseShareBody(req.body);
    const data = await aiThreadService.shareAiTurnToThreadChat({
      requesterId: req.user.id,
      threadId,
      aiTurnId: body.aiTurnId,
    });
    emitNewMessage(data.message);
    await emitUnreadForRecipients(data.thread.chatId, req.user.id);
    return sendSuccess(res, { message: data.message }, "AI answer shared", 201);
  } catch (error) {
    return next(error);
  }
};

export const postAiThreadForward = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const threadId = aiThreadService.parseThreadId(req.params.threadId);
    const body = aiThreadService.parseForwardBody(req.body);
    const data = await aiThreadService.forwardAiTurnToChat({
      requesterId: req.user.id,
      threadId,
      aiTurnId: body.aiTurnId,
      toChatId: body.toChatId,
    });
    emitNewMessage(data.message);
    await emitUnreadForRecipients(body.toChatId, req.user.id);
    return sendSuccess(res, { message: data.message }, "AI answer forwarded", 201);
  } catch (error) {
    return next(error);
  }
};
