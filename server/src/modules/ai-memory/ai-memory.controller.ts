import { NextFunction, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { AuthRequest } from "../../types";
import { sendSuccess } from "../../utils/response";
import { aiMemoryService } from "./ai-memory.service";

export const postKnowledgeExtract = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = aiMemoryService.parseKnowledgeExtractBody(req.body);
    const messages = await aiMemoryService.loadMessagesForExtraction(req.user.id, {
      chatId: body.chatId,
      groupId: body.groupId,
      messageIds: body.messageIds,
    });
    const data = await aiMemoryService.createKnowledgeAndMemory({
      userId: req.user.id,
      messages,
      requestedType: body.knowledgeType,
      title: body.title,
      summary: body.summary,
      saveToMemory: body.saveToMemory,
    });
    return sendSuccess(res, data, "Knowledge extracted", 201);
  } catch (error) {
    return next(error);
  }
};

export const getKnowledge = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const query = aiMemoryService.parseKnowledgeListQuery(req.query);
    const items = await aiMemoryService.listKnowledge(req.user.id, query);
    return sendSuccess(res, { items });
  } catch (error) {
    return next(error);
  }
};

export const patchKnowledge = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const knowledgeId = String(req.params.id ?? "").trim();
    if (!knowledgeId) throw new AppError(400, "id is required");
    const body = aiMemoryService.parseKnowledgePatchBody(req.body);
    const item = await aiMemoryService.patchKnowledge(req.user.id, knowledgeId, body);
    return sendSuccess(res, { item }, "Knowledge updated");
  } catch (error) {
    return next(error);
  }
};

export const postMemoryPin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = aiMemoryService.parseMemoryPinBody(req.body);
    const item = await aiMemoryService.pinMemory(req.user.id, body.memoryId);
    return sendSuccess(res, { item }, "Memory pin updated");
  } catch (error) {
    return next(error);
  }
};

export const postMemoryForget = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = aiMemoryService.parseMemoryForgetBody(req.body);
    const result = await aiMemoryService.forgetMemory(req.user.id, body);
    return sendSuccess(res, result, "Memory forgotten");
  } catch (error) {
    return next(error);
  }
};

export const getMemorySearch = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const query = aiMemoryService.parseMemorySearchQuery(req.query);
    const items = await aiMemoryService.searchMemory(req.user.id, query);
    return sendSuccess(res, { items });
  } catch (error) {
    return next(error);
  }
};

export const getGroupInsights = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId ?? "").trim();
    if (!groupId) throw new AppError(400, "groupId is required");
    const query = aiMemoryService.parseGroupInsightQuery(req.query);
    const items = await aiMemoryService.getGroupInsights(req.user.id, groupId, query.limit ?? 20);
    return sendSuccess(res, { items });
  } catch (error) {
    return next(error);
  }
};

export const getGroupDecisions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId ?? "").trim();
    if (!groupId) throw new AppError(400, "groupId is required");
    const query = aiMemoryService.parseGroupInsightQuery(req.query);
    const items = await aiMemoryService.getGroupDecisions(req.user.id, groupId, query.limit ?? 20);
    return sendSuccess(res, { items });
  } catch (error) {
    return next(error);
  }
};

export const getGroupTasks = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const groupId = String(req.params.groupId ?? "").trim();
    if (!groupId) throw new AppError(400, "groupId is required");
    const query = aiMemoryService.parseGroupInsightQuery(req.query);
    const items = await aiMemoryService.getGroupTasks(req.user.id, groupId, query.limit ?? 20);
    return sendSuccess(res, { items });
  } catch (error) {
    return next(error);
  }
};

export const postContextRespond = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const body = aiMemoryService.parseContextRespondBody(req.body);
    const result = await aiMemoryService.respondWithContext(req.user.id, body);
    return sendSuccess(res, result, "Context response ready");
  } catch (error) {
    return next(error);
  }
};
