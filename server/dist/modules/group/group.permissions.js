"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireCreator = exports.requireGroupMember = exports.requireAtLeastAdmin = exports.withGroupRole = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const group_service_1 = require("./group.service");
const resolveGroupId = (req) => String(req.params.groupId ?? req.params.id ?? "");
const withGroupRole = async (req, _res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = resolveGroupId(req);
        if (!groupId)
            throw new errorHandler_1.AppError(400, "groupId is required");
        req.groupRole =
            await group_service_1.groupService.requireGroupRole(groupId, req.user.id);
        return next();
    }
    catch (error) {
        return next(error);
    }
};
exports.withGroupRole = withGroupRole;
const requireAtLeastAdmin = async (req, _res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = resolveGroupId(req);
        if (!groupId)
            throw new errorHandler_1.AppError(400, "groupId is required");
        await group_service_1.groupService.requireAtLeastAdmin(groupId, req.user.id);
        return next();
    }
    catch (error) {
        return next(error);
    }
};
exports.requireAtLeastAdmin = requireAtLeastAdmin;
const requireGroupMember = async (req, _res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = resolveGroupId(req);
        if (!groupId)
            throw new errorHandler_1.AppError(400, "groupId is required");
        await group_service_1.groupService.requireGroupRole(groupId, req.user.id);
        return next();
    }
    catch (error) {
        return next(error);
    }
};
exports.requireGroupMember = requireGroupMember;
const requireCreator = async (req, _res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, "Unauthorized");
        const groupId = resolveGroupId(req);
        if (!groupId)
            throw new errorHandler_1.AppError(400, "groupId is required");
        await group_service_1.groupService.requireCreator(groupId, req.user.id);
        return next();
    }
    catch (error) {
        return next(error);
    }
};
exports.requireCreator = requireCreator;
