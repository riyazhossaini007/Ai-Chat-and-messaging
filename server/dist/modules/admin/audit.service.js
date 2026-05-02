"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditService = void 0;
const prisma_1 = require("../../config/prisma");
const logAction = async (input) => {
    return prisma_1.prisma.auditLog.create({
        data: {
            actorUserId: input.actorUserId,
            action: input.action,
            targetType: input.targetType,
            targetId: input.targetId ?? null,
            meta: input.meta ?? undefined,
            ip: input.req?.ip ?? null,
            userAgent: typeof input.req?.headers["user-agent"] === "string" ? input.req.headers["user-agent"] : null,
        },
    });
};
exports.auditService = {
    logAction,
};
