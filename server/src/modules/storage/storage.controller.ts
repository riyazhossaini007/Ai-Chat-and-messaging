import { NextFunction, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { AuthRequest } from "../../types";
import { sendSuccess } from "../../utils/response";
import { storageService } from "./storage.service";

export const getStorageUsage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const usage = await storageService.getStorageUsage(req.user.id);
    return sendSuccess(res, usage);
  } catch (error) {
    return next(error);
  }
};

