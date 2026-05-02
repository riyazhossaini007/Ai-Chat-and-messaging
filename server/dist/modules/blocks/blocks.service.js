"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blocksService = void 0;
const prisma_1 = require("../../config/prisma");
const errorHandler_1 = require("../../middlewares/errorHandler");
const listBlocked = async (blockerId) => {
    const rows = await prisma_1.prisma.userBlock.findMany({
        where: { blockerId },
        orderBy: { createdAt: "desc" },
        include: {
            blocked: {
                select: {
                    id: true,
                    username: true,
                    avatar: true,
                },
            },
        },
    });
    return rows.map((row) => ({
        userId: row.blocked.id,
        username: row.blocked.username,
        avatar: row.blocked.avatar,
        blockedAt: row.createdAt,
    }));
};
const resolveTargetUserId = async (input) => {
    const userId = input.userId?.trim();
    if (userId) {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });
        if (!user)
            throw new errorHandler_1.AppError(404, "User not found");
        return user.id;
    }
    const username = input.username?.replace(/^@/, "").trim();
    if (!username) {
        throw new errorHandler_1.AppError(400, "userId or username is required");
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { username },
        select: { id: true },
    });
    if (!user)
        throw new errorHandler_1.AppError(404, "User not found");
    return user.id;
};
const blockUser = async (blockerId, input) => {
    const targetId = await resolveTargetUserId(input);
    if (targetId === blockerId) {
        throw new errorHandler_1.AppError(400, "You cannot block yourself");
    }
    await prisma_1.prisma.userBlock.upsert({
        where: {
            blockerId_blockedId: {
                blockerId,
                blockedId: targetId,
            },
        },
        update: {},
        create: {
            blockerId,
            blockedId: targetId,
        },
    });
    const blocked = await prisma_1.prisma.user.findUnique({
        where: { id: targetId },
        select: {
            id: true,
            username: true,
            avatar: true,
        },
    });
    if (!blocked)
        throw new errorHandler_1.AppError(404, "User not found");
    return {
        userId: blocked.id,
        username: blocked.username,
        avatar: blocked.avatar,
    };
};
const unblockUser = async (blockerId, blockedUserId) => {
    const targetId = blockedUserId.trim();
    if (!targetId)
        throw new errorHandler_1.AppError(400, "blocked userId is required");
    await prisma_1.prisma.userBlock.deleteMany({
        where: {
            blockerId,
            blockedId: targetId,
        },
    });
    return { unblockedUserId: targetId };
};
exports.blocksService = {
    listBlocked,
    blockUser,
    unblockUser,
};
