import { NextFunction, Response } from "express";
import { AuthRequest } from "../types";
import { AppError } from "./errorHandler";
import { rbacService } from "../modules/security/rbac.service";
import { stepUpService } from "../modules/security/stepup.service";
import { securityService } from "../modules/security/security.service";

export const requireSuperadminStepUp = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const isSuperAdmin = await rbacService.userHasRole(req.user.id, "SUPERADMIN");
    if (!isSuperAdmin) throw new AppError(403, "SUPERADMIN required");
    const token = String(req.headers["x-admin-stepup-token"] ?? "").trim();
    const check = await stepUpService.validateStepUpToken({
      userId: req.user.id,
      token,
    });
    if (!check.valid) {
      await securityService.logSecurityEvent({
        userId: req.user.id,
        type: "ACCESS_DENIED",
        route: req.originalUrl,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        requestId: (req.body?.requestId as string | undefined) ?? undefined,
        details: { reason: "step_up_required_or_invalid" },
      });
      throw new AppError(403, "STEP_UP_REQUIRED");
    }
    return next();
  } catch (error) {
    return next(error);
  }
};
