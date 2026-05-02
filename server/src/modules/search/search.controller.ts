import { NextFunction, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import { AuthRequest } from "../../types";
import { sendSuccess } from "../../utils/response";
import { aiMemoryService } from "../ai-memory/ai-memory.service";

export const getSemanticSearch = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, "Unauthorized");
    const query = aiMemoryService.parseSemanticSearchQuery(req.query);
    const result = await aiMemoryService.semanticSearch(req.user.id, query);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};
