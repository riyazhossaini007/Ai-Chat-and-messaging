"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.privacyGuard = exports.shouldBroadcastReadReceipts = exports.canViewByAudience = exports.canMessage = exports.isBlocked = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
const hasExistingDirectChat = async (aUserId, bUserId) => {
    const count = await prisma_1.prisma.chat.count({
        where: {
            type: "DIRECT",
            participants: { some: { userId: aUserId } },
            AND: [{ participants: { some: { userId: bUserId } } }],
        },
    });
    return count > 0;
};
const isBlocked = async (aUserId, bUserId) => {
    if (!aUserId || !bUserId)
        return false;
    const row = await prisma_1.prisma.userBlock.findFirst({
        where: {
            OR: [
                { blockerId: aUserId, blockedId: bUserId },
                { blockerId: bUserId, blockedId: aUserId },
            ],
        },
        select: { id: true },
    });
    return Boolean(row);
};
exports.isBlocked = isBlocked;
const canMessage = async (senderId, receiverId) => {
    if (await (0, exports.isBlocked)(senderId, receiverId))
        return false;
    const receiverSettings = await prisma_1.prisma.userSettings.findUnique({
        where: { userId: receiverId },
        select: { allowMessagesFromNonContacts: true },
    });
    if (!receiverSettings || receiverSettings.allowMessagesFromNonContacts) {
        return true;
    }
    return hasExistingDirectChat(senderId, receiverId);
};
exports.canMessage = canMessage;
const canViewByAudience = async (viewerId, ownerId, audience) => {
    if (!viewerId || !ownerId)
        return false;
    if (viewerId === ownerId)
        return true;
    if (await (0, exports.isBlocked)(viewerId, ownerId))
        return false;
    if (audience === client_1.PrivacyAudience.EVERYONE)
        return true;
    if (audience === client_1.PrivacyAudience.NOBODY)
        return false;
    return hasExistingDirectChat(viewerId, ownerId);
};
exports.canViewByAudience = canViewByAudience;
const shouldBroadcastReadReceipts = async (userId) => {
    const settings = await prisma_1.prisma.userSettings.findUnique({
        where: { userId },
        select: { readReceiptsEnabled: true },
    });
    return settings?.readReceiptsEnabled ?? true;
};
exports.shouldBroadcastReadReceipts = shouldBroadcastReadReceipts;
exports.privacyGuard = {
    isBlocked: exports.isBlocked,
    canMessage: exports.canMessage,
    canViewByAudience: exports.canViewByAudience,
    shouldBroadcastReadReceipts: exports.shouldBroadcastReadReceipts,
};
