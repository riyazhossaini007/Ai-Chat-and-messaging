"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = void 0;
const prisma_1 = require("../../config/prisma");
const errorHandler_1 = require("../../middlewares/errorHandler");
const privacy_guard_1 = require("../privacy/privacy.guard");
const client_1 = require("@prisma/client");
const credits_service_1 = require("../credits/credits.service");
const getMe = async (userId) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            username: true,
            name: true,
            phone: true,
            avatar: true,
            isVerified: true,
            role: true,
            status: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    if (!user) {
        throw new errorHandler_1.AppError(404, "User not found");
    }
    const credits = await credits_service_1.creditsService.getWalletSummary(user.id);
    const subscriptionActive = await credits_service_1.creditsService.hasActiveSubscription(user.id);
    return {
        ...user,
        plan: subscriptionActive ? "PAID" : "FREE",
        subscriptionActive,
        credits,
    };
};
const getNearbyUsers = async (currentUserId) => {
    const users = await prisma_1.prisma.user.findMany({
        where: {
            id: { not: currentUserId },
        },
        orderBy: {
            createdAt: "desc",
        },
        select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            settings: {
                select: {
                    profilePhotoAudience: true,
                },
            },
        },
        take: 20,
    });
    return Promise.all(users.map(async (user) => {
        const canViewPhoto = await privacy_guard_1.privacyGuard.canViewByAudience(currentUserId, user.id, user.settings?.profilePhotoAudience ?? client_1.PrivacyAudience.EVERYONE);
        return {
            id: user.id,
            username: user.username,
            name: user.name,
            avatar: canViewPhoto ? user.avatar : null,
        };
    }));
};
const updateMe = async (userId, input) => {
    if (!input.name && input.avatar === undefined && !input.username) {
        throw new errorHandler_1.AppError(400, "No updatable fields provided");
    }
    if (input.username) {
        const existing = await prisma_1.prisma.user.findUnique({ where: { username: input.username } });
        if (existing && existing.id !== userId) {
            throw new errorHandler_1.AppError(409, "Username already taken");
        }
    }
    const updated = await prisma_1.prisma.user.update({
        where: { id: userId },
        data: {
            name: input.name?.trim(),
            avatar: input.avatar,
            username: input.username?.trim(),
        },
        select: {
            id: true,
            username: true,
            name: true,
            phone: true,
            avatar: true,
            isVerified: true,
            role: true,
            status: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    const credits = await credits_service_1.creditsService.getWalletSummary(updated.id);
    const subscriptionActive = await credits_service_1.creditsService.hasActiveSubscription(updated.id);
    return {
        ...updated,
        plan: subscriptionActive ? "PAID" : "FREE",
        subscriptionActive,
        credits,
    };
};
const deleteMe = async (userId) => {
    await prisma_1.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
            where: { id: userId },
            select: { id: true, phone: true },
        });
        if (!user)
            throw new errorHandler_1.AppError(404, "User not found");
        const ownedGroups = await tx.groupMember.findMany({
            where: { userId, role: "CREATOR" },
            select: { groupId: true, group: { select: { chatId: true } } },
        });
        const ownedGroupChatIds = ownedGroups.map((item) => item.group.chatId);
        if (ownedGroupChatIds.length > 0) {
            await tx.chat.deleteMany({ where: { id: { in: ownedGroupChatIds } } });
        }
        const participantChats = await tx.chatParticipant.findMany({
            where: { userId },
            select: { chatId: true },
        });
        const chatIds = participantChats.map((item) => item.chatId);
        await tx.chatParticipant.deleteMany({ where: { userId } });
        await tx.message.deleteMany({ where: { senderId: userId } });
        await tx.userSettings.deleteMany({ where: { userId } });
        await tx.otp.deleteMany({ where: { phoneNumber: user.phone } });
        if (chatIds.length > 0) {
            const emptyChats = await tx.chat.findMany({
                where: { id: { in: chatIds } },
                include: { participants: { select: { id: true } } },
            });
            const toDelete = emptyChats
                .filter((chat) => chat.participants.length === 0)
                .map((chat) => chat.id);
            if (toDelete.length > 0) {
                await tx.chat.deleteMany({ where: { id: { in: toDelete } } });
            }
        }
        await tx.user.delete({ where: { id: userId } });
    });
    return { ok: true };
};
exports.userService = {
    getMe,
    getNearbyUsers,
    updateMe,
    deleteMe,
};
