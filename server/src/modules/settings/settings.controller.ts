import { NextFunction, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { AuthRequest } from "../../types";
import { sendSuccess } from "../../utils/response";
import { settingsService } from "./settings.service";

export const getSettings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const settings = await settingsService.getOrCreateSettings(req.user.id);
    return sendSuccess(res, { settings });
  } catch (error) {
    return next(error);
  }
};

export const patchSettings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const settings = await settingsService.updateSettings(req.user.id, req.body as unknown);
    return sendSuccess(res, { settings }, "Settings updated");
  } catch (error) {
    return next(error);
  }
};

export const postAvatarRequest = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const result = await settingsService.createAvatarRequest(req.user.id, req.body as unknown);
    return sendSuccess(res, result, "Avatar request submitted", 201);
  } catch (error) {
    return next(error);
  }
};
