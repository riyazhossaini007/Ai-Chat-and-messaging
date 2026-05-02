import { NextFunction, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { AuthRequest } from "../../types";
import { sendSuccess } from "../../utils/response";
import { userService } from "./user.service";

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const user = await userService.getMe(req.user.id);
    return sendSuccess(res, { user });
  } catch (error) {
    return next(error);
  }
};

export const getNearbyUsers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const users = await userService.getNearbyUsers(req.user.id);
    return sendSuccess(res, { users });
  } catch (error) {
    return next(error);
  }
};

export const patchMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const user = await userService.updateMe(req.user.id, req.body);
    return sendSuccess(res, { user }, "Profile updated");
  } catch (error) {
    return next(error);
  }
};

export const deleteMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    await userService.deleteMe(req.user.id);
    return sendSuccess(res, { ok: true }, "Account deleted");
  } catch (error) {
    return next(error);
  }
};
