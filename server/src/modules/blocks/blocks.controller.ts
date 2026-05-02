import { NextFunction, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { AuthRequest } from "../../types";
import { sendSuccess } from "../../utils/response";
import { blocksService } from "./blocks.service";

export const getBlocks = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const blocks = await blocksService.listBlocked(req.user.id);
    return sendSuccess(res, { blocks });
  } catch (error) {
    return next(error);
  }
};

export const postBlock = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const blockedUser = await blocksService.blockUser(req.user.id, {
      userId: typeof req.body?.userId === "string" ? req.body.userId : undefined,
      username: typeof req.body?.username === "string" ? req.body.username : undefined,
    });
    return sendSuccess(res, { blockedUser }, "User blocked");
  } catch (error) {
    return next(error);
  }
};

export const deleteBlock = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const userId = String(req.params.userId ?? "");
    const data = await blocksService.unblockUser(req.user.id, userId);
    return sendSuccess(res, data, "User unblocked");
  } catch (error) {
    return next(error);
  }
};
