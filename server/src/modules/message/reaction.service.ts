import { prisma } from "../../config/prisma";

export type ReactionSummaryItem = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export type ReactionCountItem = {
  emoji: string;
  count: number;
};

const sortReactionCounts = (items: ReactionCountItem[]) =>
  items.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.emoji.localeCompare(b.emoji);
  });

export const buildReactionSummaryMap = async (
  messageIds: string[],
  viewerUserId: string
) => {
  if (messageIds.length === 0) {
    return new Map<string, ReactionSummaryItem[]>();
  }

  const rows = await prisma.messageReaction.findMany({
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

  const aggregate = new Map<
    string,
    Map<string, { count: number; reactedByMe: boolean }>
  >();

  rows.forEach((row) => {
    const byEmoji = aggregate.get(row.messageId) ?? new Map();
    const current = byEmoji.get(row.emoji) ?? { count: 0, reactedByMe: false };
    byEmoji.set(row.emoji, {
      count: current.count + 1,
      reactedByMe: current.reactedByMe || row.userId === viewerUserId,
    });
    aggregate.set(row.messageId, byEmoji);
  });

  const summaryMap = new Map<string, ReactionSummaryItem[]>();
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
      if (b.count !== a.count) return b.count - a.count;
      return a.emoji.localeCompare(b.emoji);
    });
    summaryMap.set(messageId, list);
  });

  return summaryMap;
};

export const buildReactionSummary = async (
  messageId: string,
  viewerUserId: string
) => {
  const summaryMap = await buildReactionSummaryMap([messageId], viewerUserId);
  return summaryMap.get(messageId) ?? [];
};

export const buildReactionCounts = (
  summary: ReactionSummaryItem[]
): ReactionCountItem[] =>
  sortReactionCounts(
    summary
      .filter((item) => item.count > 0)
      .map((item) => ({
        emoji: item.emoji,
        count: item.count,
      }))
  );

export const getMessageReactionDetails = async (messageId: string) => {
  const rows = await prisma.messageReaction.findMany({
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

  const grouped = new Map<
    string,
    Array<{
      id: string;
      username: string;
      avatar: string | null;
      createdAt: Date;
    }>
  >();

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
    if (b.count !== a.count) return b.count - a.count;
    return a.emoji.localeCompare(b.emoji);
  });

  return reactions;
};
