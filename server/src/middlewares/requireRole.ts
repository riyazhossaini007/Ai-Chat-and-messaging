import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../types";
import { AppError } from "./errorHandler";

type AppRole = "USER" | "MODERATOR" | "ADMIN" | "SUPERADMIN";

const ROLE_WEIGHT: Record<AppRole, number> = {
  USER: 1,
  MODERATOR: 2,
  ADMIN: 3,
  SUPERADMIN: 4,
};

export const requireRole = (...roles: AppRole[]) => {
  const minWeight = Math.min(...roles.map((role) => ROLE_WEIGHT[role]));
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError(401, "Unauthorized");
      const role = req.user.role;
      if (!role || (ROLE_WEIGHT[role] ?? 0) < minWeight) {
        throw new AppError(403, "Forbidden", { code: "insufficient-role", roles });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

