import { NextFunction, Response } from "express";
import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { AuthRequest } from "../../types";
import { sendSuccess } from "../../utils/response";
import { chatService } from "./chat.service";

export const createOrGetPrivateChat = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    const body = req.body as { userId?: string; username?: string };
    let targetUserId = body.userId?.trim();

    if (!targetUserId && body.username) {
      const normalizedUsername = body.username.replace(/^@/, "").trim();
      const user = await prisma.user.findUnique({
        where: { username: normalizedUsername },
        select: { id: true },
      });
      if (!user) throw new AppError(404, "User not found");
      targetUserId = user.id;
    }

    if (!targetUserId) {
      throw new AppError(400, "userId or username is required");
    }

    const chat = await chatService.createDirect(req.user.id, targetUserId);
    return sendSuccess(res, { chat }, "Private chat ready");
  } catch (error) {
    return next(error);
  }
};
