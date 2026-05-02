"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSemanticSearch = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const ai_memory_service_1 = require("../ai-memory/ai-memory.service");
const getSemanticSearch = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const query = ai_memory_service_1.aiMemoryService.parseSemanticSearchQuery(req.query);
        const result = await ai_memory_service_1.aiMemoryService.semanticSearch(req.user.id, query);
        return (0, response_1.sendSuccess)(res, result);
    }
    catch (error) {
        return next(error);
    }
};
exports.getSemanticSearch = getSemanticSearch;
