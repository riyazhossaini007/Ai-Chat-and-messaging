import type { NextFunction, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import type { AuthRequest } from "../../types";
import { sendSuccess } from "../../utils/response";
import { callService } from "./call.service";
import type { StartCallInput } from "./call.types";

const getCurrentUserId = (req: AuthRequest) => {
  if (!req.user) throw new AppError(401, "Unauthorized");
  return req.user.id;
};

export const startCall = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = getCurrentUserId(req);
    const payload = req.body as StartCallInput;
    const data = await callService.startCall(userId, payload);
    return sendSuccess(res, data, "Call started", 201);
  } catch (error) {
    return next(error);
  }
};

export const acceptCall = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = getCurrentUserId(req);
    const callId = String(req.params.callId || "");
    if (!callId) throw new AppError(400, "callId is required");
    await callService.acceptCall(userId, { callId }, (req.body as any)?.deviceInfo);
    return sendSuccess(res, { callId }, "Call accepted");
  } catch (error) {
    return next(error);
  }
};

export const declineCall = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = getCurrentUserId(req);
    const callId = String(req.params.callId || "");
    if (!callId) throw new AppError(400, "callId is required");
    await callService.declineCall(userId, { callId });
    return sendSuccess(res, { callId }, "Call declined");
  } catch (error) {
    return next(error);
  }
};

export const endCall = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = getCurrentUserId(req);
    const callId = String(req.params.callId || "");
    if (!callId) throw new AppError(400, "callId is required");
    await callService.endCall(userId, { callId });
    return sendSuccess(res, { callId }, "Call ended");
  } catch (error) {
    return next(error);
  }
};

export const getCallHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = getCurrentUserId(req);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limitRaw = Number(req.query.limit ?? "20");
    const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
    const filter = req.query.filter === "missed" ? "missed" : "all";
    const data = await callService.getCallHistory({
      userId,
      cursor,
      limit,
      filter,
    });
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
};

export const getCallById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = getCurrentUserId(req);
    const callId = String(req.params.callId || "");
    if (!callId) throw new AppError(400, "callId is required");
    const call = await callService.getCallById(userId, callId);
    return sendSuccess(res, { call });
  } catch (error) {
    return next(error);
  }
};

export const joinSfu = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = getCurrentUserId(req);
    const callId = String(req.params.callId || "");
    if (!callId) throw new AppError(400, "callId is required");
    const data = await callService.sfuJoin(userId, callId);
    return sendSuccess(res, data, "SFU join token issued");
  } catch (error) {
    return next(error);
  }
};

export const leaveSfu = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = getCurrentUserId(req);
    const callId = String(req.params.callId || "");
    if (!callId) throw new AppError(400, "callId is required");
    await callService.sfuLeave(userId, callId);
    return sendSuccess(res, { callId }, "Left SFU call");
  } catch (error) {
    return next(error);
  }
};

export const endSfu = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = getCurrentUserId(req);
    const callId = String(req.params.callId || "");
    if (!callId) throw new AppError(400, "callId is required");
    await callService.sfuEnd(userId, callId);
    return sendSuccess(res, { callId }, "SFU call ended");
  } catch (error) {
    return next(error);
  }
};

export const livekitWebhook = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.rawBody) throw new AppError(400, "Missing raw body");
    const authorizationHeader =
      typeof req.headers.authorization === "string" ? req.headers.authorization : undefined;
    const data = await callService.handleLivekitWebhook(req.rawBody, authorizationHeader);
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
};
