import { NextFunction, Response } from "express";
import { AuthRequest } from "../../types";
import { AppError } from "../../middlewares/errorHandler";
import { sendSuccess } from "../../utils/response";
import { rbacService } from "./rbac.service";
import { securityService } from "./security.service";
import { prisma } from "../../config/prisma";

const parseRole = (value: unknown): "USER" | "MODERATOR" | "ADMIN" | "SUPERADMIN" => {
  const role = String(value ?? "").trim().toUpperCase();
  if (role === "USER" || role === "MODERATOR" || role === "ADMIN" || role === "SUPERADMIN") {
    return role;
  }
  throw new AppError(400, "Invalid role");
};

export const getRoleUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const query = typeof req.query.query === "string" ? req.query.query : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const users = await rbacService.listUsersWithRoles({ query, limit });
    return sendSuccess(res, { users });
  } catch (error) {
    return next(error);
  }
};

export const assignUserRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = req.body as { userId?: string; role?: string; reason?: string; requestId?: string };
    const userId = String(body.userId ?? "").trim();
    if (!userId) throw new AppError(400, "userId is required");
    const role = parseRole(body.role);
    const reason = String(body.reason ?? "").trim();
    if (!reason) throw new AppError(400, "reason is required");

    const before = await rbacService.getUserRoles(userId);
    await rbacService.assignRole({ userId, role });
    const after = await rbacService.getUserRoles(userId);
    await securityService.createAdminActionAuditLog({
      actorUserId: req.user.id,
      targetUserId: userId,
      action: "ROLE_ASSIGN",
      reason,
      before,
      after,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      requestId: String(body.requestId ?? "").trim() || `role-${Date.now()}`,
    });

    return sendSuccess(res, { userId, before, after }, "Role assigned");
  } catch (error) {
    return next(error);
  }
};

export const revokeUserRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = req.body as { userId?: string; role?: string; reason?: string; requestId?: string };
    const userId = String(body.userId ?? "").trim();
    if (!userId) throw new AppError(400, "userId is required");
    const role = parseRole(body.role);
    const reason = String(body.reason ?? "").trim();
    if (!reason) throw new AppError(400, "reason is required");
    if (userId === req.user.id && role === "SUPERADMIN") {
      throw new AppError(400, "Cannot revoke your own SUPERADMIN role");
    }

    const before = await rbacService.getUserRoles(userId);
    await rbacService.revokeRole({ userId, role });
    const after = await rbacService.getUserRoles(userId);
    await securityService.createAdminActionAuditLog({
      actorUserId: req.user.id,
      targetUserId: userId,
      action: "ROLE_REVOKE",
      reason,
      before,
      after,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      requestId: String(body.requestId ?? "").trim() || `role-${Date.now()}`,
    });

    return sendSuccess(res, { userId, before, after }, "Role revoked");
  } catch (error) {
    return next(error);
  }
};

export const getRoleAuditLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 100;
    const rows = await prisma.adminActionAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(500, limit)),
    });
    return sendSuccess(res, { logs: rows });
  } catch (error) {
    return next(error);
  }
};
