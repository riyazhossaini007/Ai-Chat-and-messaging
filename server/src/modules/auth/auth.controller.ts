import { NextFunction, Request, Response } from "express";
import { authService } from "./auth.service";
import { sendSuccess } from "../../utils/response";
import { AuthRequest } from "../../types";
import { AppError } from "../../middlewares/errorHandler";

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.register(req.body);
    return sendSuccess(res, result, "User registered. Verify OTP.", 201);
  } catch (error) {
    return next(error);
  }
};

export const verify = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.verify(req.body);
    return sendSuccess(res, result, "User verified");
  } catch (error) {
    return next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.login(req.body);
    return sendSuccess(res, result, "Logged in");
  } catch (error) {
    return next(error);
  }
};

export const logout = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logout();
    return sendSuccess(res, { ok: true }, "Logged out");
  } catch (error) {
    return next(error);
  }
};

export const startAdminStepUp = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = req.body as { password?: string; reason?: string };
    if (!body.password) throw new AppError(400, "password is required");
    if (!body.reason) throw new AppError(400, "reason is required");
    const result = await authService.startSuperadminStepUp({
      userId: req.user.id,
      password: body.password,
      reason: body.reason,
    });
    return sendSuccess(res, result, "Step-up challenge started");
  } catch (error) {
    return next(error);
  }
};

export const verifyAdminStepUp = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = req.body as { challengeId?: string; otp?: string };
    if (!body.challengeId) throw new AppError(400, "challengeId is required");
    if (!body.otp) throw new AppError(400, "otp is required");
    const result = await authService.verifySuperadminStepUp({
      userId: req.user.id,
      challengeId: body.challengeId,
      otp: body.otp,
    });
    return sendSuccess(res, result, "Step-up verified");
  } catch (error) {
    return next(error);
  }
};
