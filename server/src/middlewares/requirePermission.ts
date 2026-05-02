import { NextFunction, Response } from "express";
import { AuthRequest } from "../types";
import { AppError } from "./errorHandler";
import { rbacService } from "../modules/security/rbac.service";
import { securityService } from "../modules/security/security.service";

export const requirePermission = (permissionKey: string) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError(401, "Unauthorized");
      const allowed = await rbacService.userHasPermission(req.user.id, permissionKey);
      if (!allowed) {
        await securityService.logSecurityEvent({
          userId: req.user.id,
          type: "ACCESS_DENIED",
          route: req.originalUrl,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          requestId: (req.body?.requestId as string | undefined) ?? undefined,
          details: { permissionKey },
        });
        throw new AppError(403, "Forbidden");
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
};

