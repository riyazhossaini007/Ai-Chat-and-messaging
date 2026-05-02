import { NextFunction, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { AuthRequest } from "../../types";
import { groupService } from "./group.service";

const resolveGroupId = (req: AuthRequest) =>
  String(req.params.groupId ?? req.params.id ?? "");

export const withGroupRole = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = resolveGroupId(req);
    if (!groupId) throw new AppError(400, "groupId is required");
    (req as AuthRequest & { groupRole?: string }).groupRole =
      await groupService.requireGroupRole(groupId, req.user.id);
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireAtLeastAdmin = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = resolveGroupId(req);
    if (!groupId) throw new AppError(400, "groupId is required");
    await groupService.requireAtLeastAdmin(groupId, req.user.id);
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireGroupMember = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = resolveGroupId(req);
    if (!groupId) throw new AppError(400, "groupId is required");
    await groupService.requireGroupRole(groupId, req.user.id);
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireCreator = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = resolveGroupId(req);
    if (!groupId) throw new AppError(400, "groupId is required");
    await groupService.requireCreator(groupId, req.user.id);
    return next();
  } catch (error) {
    return next(error);
  }
};
