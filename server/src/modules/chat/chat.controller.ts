import { NextFunction, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { emitUnreadResetToUser } from "../../socket";
import { AuthRequest } from "../../types";
import { sendSuccess } from "../../utils/response";
import { chatService } from "./chat.service";

export const createDirect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const { userId } = req.body as { userId?: string };
    if (!userId) throw new AppError(400, "userId is required");

    const chat = await chatService.createDirect(req.user.id, userId);
    return sendSuccess(res, { chat }, "Direct chat ready", 201);
  } catch (error) {
    return next(error);
  }
};

export const getChats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const chats = await chatService.getChats(req.user.id);
    return sendSuccess(res, { chats });
  } catch (error) {
    return next(error);
  }
};

export const markChatRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const chatId = String(req.params.chatId);
    const data = await chatService.markChatRead(req.user.id, chatId);

    emitUnreadResetToUser(req.user.id, {
      chatId,
      unreadCount: 0,
    });

    return sendSuccess(res, data, "Chat marked as read");
  } catch (error) {
    return next(error);
  }
};

export const getUnreadTotal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const total = await chatService.getTotalUnread(req.user.id);
    return sendSuccess(res, { total });
  } catch (error) {
    return next(error);
  }
};

export const getUnreadSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const summary = await chatService.getUnreadSummary(req.user.id);
    return sendSuccess(res, summary);
  } catch (error) {
    return next(error);
  }
};

export const togglePinChat = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const chatId = String(req.params.chatId);
    const data = await chatService.togglePinChat(req.user.id, chatId);
    return sendSuccess(res, data, "Pin state updated");
  } catch (error) {
    return next(error);
  }
};

export const archiveChat = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const chatId = String(req.params.chatId);
    const data = await chatService.archiveChat(req.user.id, chatId);
    return sendSuccess(res, data, "Chat archived");
  } catch (error) {
    return next(error);
  }
};

export const unarchiveChat = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const chatId = String(req.params.chatId);
    const data = await chatService.unarchiveChat(req.user.id, chatId);
    return sendSuccess(res, data, "Chat unarchived");
  } catch (error) {
    return next(error);
  }
};

export const reorderChats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = Array.isArray(req.body)
      ? req.body
      : (req.body as { orders?: Array<{ chatId?: string; order?: number }> })?.orders;
    const orders = (body ?? [])
      .filter((item) => item && typeof item.chatId === "string")
      .map((item) => ({
        chatId: String(item.chatId),
        order: Number.isFinite(item.order) ? Number(item.order) : 0,
      }));
    const data = await chatService.reorderChats(req.user.id, orders);
    return sendSuccess(res, data, "Chats reordered");
  } catch (error) {
    return next(error);
  }
};

export const deleteChat = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const chatId = String(req.params.id);
    await chatService.leaveChat(req.user.id, chatId);
    return sendSuccess(res, { ok: true }, "Left chat");
  } catch (error) {
    return next(error);
  }
};

export const shareChat = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const chatId = String(req.params.id);
    const data = await chatService.shareChat(req.user.id, chatId);
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
};
