"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.livekitWebhook = exports.endSfu = exports.leaveSfu = exports.joinSfu = exports.getCallById = exports.getCallHistory = exports.endCall = exports.declineCall = exports.acceptCall = exports.startCall = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const response_1 = require("../../utils/response");
const call_service_1 = require("./call.service");
const getCurrentUserId = (req) => {
    if (!req.user)
        throw new errorHandler_1.AppError(401, "Unauthorized");
    return req.user.id;
};
const startCall = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const payload = req.body;
        const data = await call_service_1.callService.startCall(userId, payload);
        return (0, response_1.sendSuccess)(res, data, "Call started", 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.startCall = startCall;
const acceptCall = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const callId = String(req.params.callId || "");
        if (!callId)
            throw new errorHandler_1.AppError(400, "callId is required");
        await call_service_1.callService.acceptCall(userId, { callId }, req.body?.deviceInfo);
        return (0, response_1.sendSuccess)(res, { callId }, "Call accepted");
    }
    catch (error) {
        return next(error);
    }
};
exports.acceptCall = acceptCall;
const declineCall = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const callId = String(req.params.callId || "");
        if (!callId)
            throw new errorHandler_1.AppError(400, "callId is required");
        await call_service_1.callService.declineCall(userId, { callId });
        return (0, response_1.sendSuccess)(res, { callId }, "Call declined");
    }
    catch (error) {
        return next(error);
    }
};
exports.declineCall = declineCall;
const endCall = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const callId = String(req.params.callId || "");
        if (!callId)
            throw new errorHandler_1.AppError(400, "callId is required");
        await call_service_1.callService.endCall(userId, { callId });
        return (0, response_1.sendSuccess)(res, { callId }, "Call ended");
    }
    catch (error) {
        return next(error);
    }
};
exports.endCall = endCall;
const getCallHistory = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
        const limitRaw = Number(req.query.limit ?? "20");
        const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
        const filter = req.query.filter === "missed" ? "missed" : "all";
        const data = await call_service_1.callService.getCallHistory({
            userId,
            cursor,
            limit,
            filter,
        });
        return (0, response_1.sendSuccess)(res, data);
    }
    catch (error) {
        return next(error);
    }
};
exports.getCallHistory = getCallHistory;
const getCallById = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const callId = String(req.params.callId || "");
        if (!callId)
            throw new errorHandler_1.AppError(400, "callId is required");
        const call = await call_service_1.callService.getCallById(userId, callId);
        return (0, response_1.sendSuccess)(res, { call });
    }
    catch (error) {
        return next(error);
    }
};
exports.getCallById = getCallById;
const joinSfu = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const callId = String(req.params.callId || "");
        if (!callId)
            throw new errorHandler_1.AppError(400, "callId is required");
        const data = await call_service_1.callService.sfuJoin(userId, callId);
        return (0, response_1.sendSuccess)(res, data, "SFU join token issued");
    }
    catch (error) {
        return next(error);
    }
};
exports.joinSfu = joinSfu;
const leaveSfu = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const callId = String(req.params.callId || "");
        if (!callId)
            throw new errorHandler_1.AppError(400, "callId is required");
        await call_service_1.callService.sfuLeave(userId, callId);
        return (0, response_1.sendSuccess)(res, { callId }, "Left SFU call");
    }
    catch (error) {
        return next(error);
    }
};
exports.leaveSfu = leaveSfu;
const endSfu = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const callId = String(req.params.callId || "");
        if (!callId)
            throw new errorHandler_1.AppError(400, "callId is required");
        await call_service_1.callService.sfuEnd(userId, callId);
        return (0, response_1.sendSuccess)(res, { callId }, "SFU call ended");
    }
    catch (error) {
        return next(error);
    }
};
exports.endSfu = endSfu;
const livekitWebhook = async (req, res, next) => {
    try {
        if (!req.rawBody)
            throw new errorHandler_1.AppError(400, "Missing raw body");
        const authorizationHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : undefined;
        const data = await call_service_1.callService.handleLivekitWebhook(req.rawBody, authorizationHeader);
        return (0, response_1.sendSuccess)(res, data);
    }
    catch (error) {
        return next(error);
    }
};
exports.livekitWebhook = livekitWebhook;
