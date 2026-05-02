import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../../types";
import { AppError } from "../../middlewares/errorHandler";
import { sendSuccess } from "../../utils/response";
import { adminService } from "./admin.service";
import { ensureEnum, parseBoolean, parseRange, parseString } from "./admin.validation";

const getActor = (req: AuthRequest) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  return req.user;
};

export const getAdminOverviewStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const range = parseRange(req.query as any, 7);
    const data = await adminService.getOverviewStats(range);
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
};

export const getAdminEntitlements = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = parseString(req.query.userId, "userId") as string;
    const items = await adminService.listEntitlements(userId);
    return sendSuccess(res, { items });
  } catch (error) {
    return next(error);
  }
};

export const postAdminGrantEntitlement = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = getActor(req);
    const userId = parseString(req.body?.userId, "userId") as string;
    const featureKey = ensureEnum(req.body?.featureKey, "featureKey", [
      "PRO_ACCESS",
      "AI_UNLIMITED",
      "CALLING",
      "GROUP_CALLING",
      "NO_ADS",
    ] as const);
    const expiresAt = req.body?.expiresAt ? new Date(String(req.body.expiresAt)) : undefined;
    const reason = parseString(req.body?.reason, "reason", { optional: true, max: 500 });
    const item = await adminService.grantEntitlement({
      actorUserId: actor.id,
      userId,
      featureKey,
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : undefined,
      reason,
      reqMeta: { req },
    });
    return sendSuccess(res, { entitlement: item }, "Entitlement granted", 201);
  } catch (error) {
    return next(error);
  }
};

export const postAdminRevokeEntitlement = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = getActor(req);
    const entitlementId = parseString(req.body?.entitlementId, "entitlementId") as string;
    const reason = parseString(req.body?.reason, "reason", { optional: true, max: 500 });
    const item = await adminService.revokeEntitlement({ actorUserId: actor.id, entitlementId, reason, req });
    return sendSuccess(res, { entitlement: item }, "Entitlement revoked");
  } catch (error) {
    return next(error);
  }
};

export const getAdminUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await adminService.listUsers(req.query as any);
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
};

export const getAdminUserDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await adminService.getUserDetail(String(req.params.id));
    return sendSuccess(res, { user: data });
  } catch (error) {
    return next(error);
  }
};

export const patchAdminUserRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = getActor(req);
    const role = ensureEnum(req.body?.role, "role", ["USER", "MODERATOR", "ADMIN", "SUPERADMIN"] as const);
    const data = await adminService.patchUserRole({ actorUserId: actor.id, userId: String(req.params.id), role, req });
    return sendSuccess(res, data, "User role updated");
  } catch (error) {
    return next(error);
  }
};

export const patchAdminUserStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = getActor(req);
    const status = ensureEnum(req.body?.status, "status", ["ACTIVE", "BANNED", "DELETED"] as const);
    if (status === "DELETED" && actor.role !== "ADMIN" && actor.role !== "SUPERADMIN") {
      throw new AppError(403, "Only admin can set DELETED status");
    }
    const reason = parseString(req.body?.reason, "reason", { optional: true, max: 1000 });
    const data = await adminService.patchUserStatus({
      actorUserId: actor.id,
      userId: String(req.params.id),
      status,
      reason,
      req,
    });
    return sendSuccess(res, data, "User status updated");
  } catch (error) {
    return next(error);
  }
};

export const patchAdminUserNote = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = getActor(req);
    const note = req.body?.note === null ? null : parseString(req.body?.note, "note", { optional: true, max: 2000 }) ?? null;
    const data = await adminService.patchUserNote({ actorUserId: actor.id, userId: String(req.params.id), note, req });
    return sendSuccess(res, data, "User note updated");
  } catch (error) {
    return next(error);
  }
};

export const getAdminAiUsage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const range = parseRange(req.query as any, 7);
    const data = await adminService.listAiUsage({
      ...range,
      userId: typeof req.query.userId === "string" ? req.query.userId : undefined,
      provider: typeof req.query.provider === "string" ? req.query.provider : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
    });
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
};

export const getAdminAiTopUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const range = parseRange(req.query as any, 7);
    const metric = ensureEnum(req.query.metric ?? "requests", "metric", ["requests", "tokens"] as const);
    const items = await adminService.getTopAiUsers({ ...range, metric });
    return sendSuccess(res, { items });
  } catch (error) {
    return next(error);
  }
};

export const getAdminReports = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await adminService.listReports(req.query as any);
    return sendSuccess(res, { items });
  } catch (error) {
    return next(error);
  }
};

export const getAdminReportDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const report = await adminService.getReport(String(req.params.id));
    return sendSuccess(res, { report });
  } catch (error) {
    return next(error);
  }
};

export const patchAdminReportStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = getActor(req);
    const status = ensureEnum(req.body?.status, "status", ["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"] as const);
    const resolutionNote = parseString(req.body?.resolutionNote, "resolutionNote", { optional: true, max: 2000 });
    const report = await adminService.patchReportStatus({
      actorUserId: actor.id,
      id: String(req.params.id),
      status,
      resolutionNote,
      req,
    });
    return sendSuccess(res, { report }, "Report updated");
  } catch (error) {
    return next(error);
  }
};

export const postAdminBanUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = getActor(req);
    const userId = parseString(req.body?.userId, "userId") as string;
    const reason = parseString(req.body?.reason, "reason", { max: 1000 }) as string;
    const user = await adminService.moderationBanUser({ actorUserId: actor.id, userId, reason, req });
    return sendSuccess(res, { user }, "User banned");
  } catch (error) {
    return next(error);
  }
};

export const postAdminRemoveMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = getActor(req);
    const messageId = parseString(req.body?.messageId, "messageId") as string;
    const reason = parseString(req.body?.reason, "reason", { max: 1000 }) as string;
    const message = await adminService.moderationRemoveMessage({ actorUserId: actor.id, messageId, reason, req });
    return sendSuccess(res, { message }, "Message removed");
  } catch (error) {
    return next(error);
  }
};

export const getAdminGroups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await adminService.listGroups(req.query as any);
    return sendSuccess(res, { items });
  } catch (error) {
    return next(error);
  }
};

export const getAdminGroupDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const group = await adminService.getGroupDetail(String(req.params.id));
    return sendSuccess(res, { group });
  } catch (error) {
    return next(error);
  }
};

export const patchAdminGroupFreeze = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = getActor(req);
    const freeze = parseBoolean(req.body?.freeze, "freeze");
    const reason = parseString(req.body?.reason, "reason", { optional: true, max: 1000 });
    const group = await adminService.freezeGroup({ actorUserId: actor.id, groupId: String(req.params.id), freeze, reason, req });
    return sendSuccess(res, { group }, freeze ? "Group frozen" : "Group unfrozen");
  } catch (error) {
    return next(error);
  }
};

export const deleteAdminGroup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = getActor(req);
    const group = await adminService.softDeleteGroup({ actorUserId: actor.id, groupId: String(req.params.id), req });
    return sendSuccess(res, { group }, "Group deleted");
  } catch (error) {
    return next(error);
  }
};

export const getAdminCalls = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await adminService.listCalls(req.query as any);
    return sendSuccess(res, { items });
  } catch (error) {
    return next(error);
  }
};

export const getAdminCallDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const call = await adminService.getCallDetail(String(req.params.id));
    return sendSuccess(res, { call });
  } catch (error) {
    return next(error);
  }
};

export const getAdminCallStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const range = parseRange(req.query as any, 7);
    const data = await adminService.getCallStats(range);
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
};

export const getAdminHealth = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const checks = await adminService.getHealth();
    return sendSuccess(res, checks);
  } catch (error) {
    return next(error);
  }
};

export const getAdminAuditLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await adminService.listAuditLogs(req.query as any);
    return sendSuccess(res, { items });
  } catch (error) {
    return next(error);
  }
};
