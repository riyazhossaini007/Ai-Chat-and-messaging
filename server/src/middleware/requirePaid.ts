import type { NextFunction, Response } from "express";
import { env } from "../config/env";
import { AppError } from "../middlewares/errorHandler";
import type { AuthRequest } from "../types";
import { callService } from "../modules/calls/call.service";

export const requirePaid = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");

    if (!env.CALLING_ENABLED) {
      throw new AppError(403, "Calling feature is disabled", {
        code: "feature-disabled",
      });
    }

    const isPaid = await callService.isPaidUser(req.user.id);
    if (!isPaid) {
      throw new AppError(402, "Paid plan required for calling", {
        code: "paid-required",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
