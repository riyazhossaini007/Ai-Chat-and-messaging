import { NextFunction, Response } from "express";
import { AuthRequest } from "../types";
import { env } from "../config/env";
import { AppError } from "./errorHandler";
import { securityService } from "../modules/security/security.service";

const normalizeIp = (value: string) => value.replace("::ffff:", "").trim();

export const requireAdminIpAllowlist = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!env.ADMIN_IP_ALLOWLIST_ENABLED) return next();
    const raw = env.ADMIN_IP_ALLOWLIST.split(",")
      .map((item) => normalizeIp(item))
      .filter(Boolean);
    const allow = new Set(raw);
    const ip = normalizeIp(req.ip ?? "");
    if (!allow.has(ip)) {
      await securityService.logSecurityEvent({
        userId: req.user?.id,
        type: "ACCESS_DENIED",
        route: req.originalUrl,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        requestId: (req.body?.requestId as string | undefined) ?? undefined,
        details: { reason: "admin_ip_allowlist", allowed: raw },
      });
      throw new AppError(403, "Forbidden from this network");
    }
    return next();
  } catch (error) {
    return next(error);
  }
};
