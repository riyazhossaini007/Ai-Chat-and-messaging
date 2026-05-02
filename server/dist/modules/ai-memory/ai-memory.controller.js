"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postContextRespond = exports.getGroupTasks = exports.getGroupDecisions = exports.getGroupInsights = exports.getMemorySearch = exports.postMemoryForget = exports.postMemoryPin = exports.patchKnowledge = exports.getKnowledge = exports.postKnowledgeExtract = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const ai_memory_service_1 = require("./ai-memory.service");
const postKnowledgeExtract = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = ai_memory_service_1.aiMemoryService.parseKnowledgeExtractBody(req.body);
        const messages = await ai_memory_service_1.aiMemoryService.loadMessagesForExtraction(req.user.id, {
            chatId: body.chatId,
            groupId: body.groupId,
            messageIds: body.messageIds,
        });
        const data = await ai_memory_service_1.aiMemoryService.createKnowledgeAndMemory({
            userId: req.user.id,
            messages,
            requestedType: body.knowledgeType,
            title: body.title,
            summary: body.summary,
            saveToMemory: body.saveToMemory,
        });
        return (0, response_1.sendSuccess)(res, data, "Knowledge extracted", 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.postKnowledgeExtract = postKnowledgeExtract;
const getKnowledge = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const query = ai_memory_service_1.aiMemoryService.parseKnowledgeListQuery(req.query);
        const items = await ai_memory_service_1.aiMemoryService.listKnowledge(req.user.id, query);
        return (0, response_1.sendSuccess)(res, { items });
    }
    catch (error) {
        return next(error);
    }
};
exports.getKnowledge = getKnowledge;
const patchKnowledge = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const knowledgeId = String(req.params.id ?? "").trim();
        if (!knowledgeId)
            throw new errorHandler_1.AppError(400, "id is required");
        const body = ai_memory_service_1.aiMemoryService.parseKnowledgePatchBody(req.body);
        const item = await ai_memory_service_1.aiMemoryService.patchKnowledge(req.user.id, knowledgeId, body);
        return (0, response_1.sendSuccess)(res, { item }, "Knowledge updated");
    }
    catch (error) {
        return next(error);
    }
};
exports.patchKnowledge = patchKnowledge;
const postMemoryPin = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = ai_memory_service_1.aiMemoryService.parseMemoryPinBody(req.body);
        const item = await ai_memory_service_1.aiMemoryService.pinMemory(req.user.id, body.memoryId);
        return (0, response_1.sendSuccess)(res, { item }, "Memory pin updated");
    }
    catch (error) {
        return next(error);
    }
};
exports.postMemoryPin = postMemoryPin;
const postMemoryForget = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = ai_memory_service_1.aiMemoryService.parseMemoryForgetBody(req.body);
        const result = await ai_memory_service_1.aiMemoryService.forgetMemory(req.user.id, body);
        return (0, response_1.sendSuccess)(res, result, "Memory forgotten");
    }
    catch (error) {
        return next(error);
    }
};
exports.postMemoryForget = postMemoryForget;
const getMemorySearch = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const query = ai_memory_service_1.aiMemoryService.parseMemorySearchQuery(req.query);
        const items = await ai_memory_service_1.aiMemoryService.searchMemory(req.user.id, query);
        return (0, response_1.sendSuccess)(res, { items });
    }
    catch (error) {
        return next(error);
    }
};
exports.getMemorySearch = getMemorySearch;
const getGroupInsights = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId ?? "").trim();
        if (!groupId)
            throw new errorHandler_1.AppError(400, "groupId is required");
        const query = ai_memory_service_1.aiMemoryService.parseGroupInsightQuery(req.query);
        const items = await ai_memory_service_1.aiMemoryService.getGroupInsights(req.user.id, groupId, query.limit ?? 20);
        return (0, response_1.sendSuccess)(res, { items });
    }
    catch (error) {
        return next(error);
    }
};
exports.getGroupInsights = getGroupInsights;
const getGroupDecisions = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId ?? "").trim();
        if (!groupId)
            throw new errorHandler_1.AppError(400, "groupId is required");
        const query = ai_memory_service_1.aiMemoryService.parseGroupInsightQuery(req.query);
        const items = await ai_memory_service_1.aiMemoryService.getGroupDecisions(req.user.id, groupId, query.limit ?? 20);
        return (0, response_1.sendSuccess)(res, { items });
    }
    catch (error) {
        return next(error);
    }
};
exports.getGroupDecisions = getGroupDecisions;
const getGroupTasks = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = String(req.params.groupId ?? "").trim();
        if (!groupId)
            throw new errorHandler_1.AppError(400, "groupId is required");
        const query = ai_memory_service_1.aiMemoryService.parseGroupInsightQuery(req.query);
        const items = await ai_memory_service_1.aiMemoryService.getGroupTasks(req.user.id, groupId, query.limit ?? 20);
        return (0, response_1.sendSuccess)(res, { items });
    }
    catch (error) {
        return next(error);
    }
};
exports.getGroupTasks = getGroupTasks;
const postContextRespond = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const body = ai_memory_service_1.aiMemoryService.parseContextRespondBody(req.body);
        const result = await ai_memory_service_1.aiMemoryService.respondWithContext(req.user.id, body);
        return (0, response_1.sendSuccess)(res, result, "Context response ready");
    }
    catch (error) {
        return next(error);
    }
};
exports.postContextRespond = postContextRespond;
