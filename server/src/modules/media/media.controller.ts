import { NextFunction, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { AuthRequest } from "../../types";
import { sendSuccess } from "../../utils/response";
import { mediaService } from "./media.service";

export const getChatMedia = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const chatId = String(req.params.chatId);
    const rawFilter = typeof req.query.filter === "string" ? req.query.filter : "THIS_CHAT";
    const filter = rawFilter === "ALL_MEDIA" ? "ALL_MEDIA" : "THIS_CHAT";

    const media = await mediaService.getChatMedia(req.user.id, chatId, filter);
    return sendSuccess(res, { media });
  } catch (error) {
    return next(error);
  }
};
