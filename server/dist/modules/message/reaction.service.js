"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessageReactionDetails = exports.buildReactionCounts = exports.buildReactionSummary = exports.buildReactionSummaryMap = void 0;
const prisma_1 = require("../../config/prisma");
const sortReactionCounts = (items) => items.sort((a, b) => {
    if (b.count !== a.count)
        return b.count - a.count;
    return a.emoji.localeCompare(b.emoji);
});
const buildReactionSummaryMap = async (messageIds, viewerUserId) => {
    if (messageIds.length === 0) {
        return new Map();
    }
    const rows = await prisma_1.prisma.messageReaction.findMany({
        where: {
            messageId: {
                in: messageIds,
            },
        },
        select: {
            messageId: true,
            emoji: true,
            userId: true,
        },
    });
    const aggregate = new Map();
    rows.forEach((row) => {
        const byEmoji = aggregate.get(row.messageId) ?? new Map();
        const current = byEmoji.get(row.emoji) ?? { count: 0, reactedByMe: false };
        byEmoji.set(row.emoji, {
            count: current.count + 1,
            reactedByMe: current.reactedByMe || row.userId === viewerUserId,
        });
        aggregate.set(row.messageId, byEmoji);
    });
    const summaryMap = new Map();
    messageIds.forEach((messageId) => {
        const byEmoji = aggregate.get(messageId);
        if (!byEmoji) {
            summaryMap.set(messageId, []);
            return;
        }
        const list = Array.from(byEmoji.entries()).map(([emoji, meta]) => ({
            emoji,
            count: meta.count,
            reactedByMe: meta.reactedByMe,
        }));
        list.sort((a, b) => {
            if (b.count !== a.count)
                return b.count - a.count;
            return a.emoji.localeCompare(b.emoji);
        });
        summaryMap.set(messageId, list);
    });
    return summaryMap;
};
exports.buildReactionSummaryMap = buildReactionSummaryMap;
const buildReactionSummary = async (messageId, viewerUserId) => {
    const summaryMap = await (0, exports.buildReactionSummaryMap)([messageId], viewerUserId);
    return summaryMap.get(messageId) ?? [];
};
exports.buildReactionSummary = buildReactionSummary;
const buildReactionCounts = (summary) => sortReactionCounts(summary
    .filter((item) => item.count > 0)
    .map((item) => ({
    emoji: item.emoji,
    count: item.count,
})));
exports.buildReactionCounts = buildReactionCounts;
const getMessageReactionDetails = async (messageId) => {
    const rows = await prisma_1.prisma.messageReaction.findMany({
        where: { messageId },
        orderBy: [{ emoji: "asc" }, { createdAt: "asc" }],
        include: {
            user: {
                select: {
                    id: true,
                    username: true,
                    avatar: true,
                },
            },
        },
    });
    const grouped = new Map();
    rows.forEach((row) => {
        const users = grouped.get(row.emoji) ?? [];
        users.push({
            id: row.user.id,
            username: row.user.username,
            avatar: row.user.avatar,
            createdAt: row.createdAt,
        });
        grouped.set(row.emoji, users);
    });
    const reactions = Array.from(grouped.entries()).map(([emoji, users]) => ({
        emoji,
        count: users.length,
        users: users.map((user) => ({
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            createdAt: user.createdAt.toISOString(),
        })),
    }));
    reactions.sort((a, b) => {
        if (b.count !== a.count)
            return b.count - a.count;
        return a.emoji.localeCompare(b.emoji);
    });
    return reactions;
};
exports.getMessageReactionDetails = getMessageReactionDetails;
