import { ChatType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { privacyGuard } from "../privacy/privacy.guard";
import { decryptText, generateDek, unwrapDek, wrapDek } from "../../security/messageCrypto";
import { getChatDek } from "../../security/chatEncryption.service";

const MAX_PINNED_CHATS = 5;

const lastMessageInclude = {
  sender: {
    select: {
      id: true,
      username: true,
      name: true,
      avatar: true,
    },
  },
} as const;

const withGroupInfo = async <T extends { id: string; type: ChatType }>(chats: T[]) => {
  const groupChatIds = chats
    .filter((chat) => chat.type === "GROUP")
    .map((chat) => chat.id);
  const groups = await prisma.group.findMany({
    where: { chatId: { in: groupChatIds } },
  });
  const groupMap = new Map(groups.map((group) => [group.chatId, group]));

  return chats.map((chat) => ({
    ...chat,
    group: groupMap.get(chat.id) ?? null,
  }));
};

const stripChatEncryptionFields = <T extends Record<string, unknown>>(chat: T) => {
  const {
    dekWrapped: _dekWrapped,
    dekKekId: _dekKekId,
    encVersion: _encVersion,
    ...rest
  } = chat as T & {
    dekWrapped?: string | null;
    dekKekId?: string | null;
    encVersion?: number;
  };
  return rest;
};

const decryptLastMessagesForChats = async <T extends {
  id: string;
  dekWrapped?: string | null;
  dekKekId?: string | null;
  messages: Array<{
    content: string | null;
    text?: string | null;
    cipherText?: string | null;
    iv?: string | null;
    authTag?: string | null;
    deletedForEveryone?: boolean;
  }>;
}>(chats: T[]) => {
  const fallbackChatIds = chats.filter((chat) => !chat.dekWrapped).map((chat) => chat.id);
  const fallbackEntries = await Promise.all(
    fallbackChatIds.map(async (chatId) => {
      const value = await getChatDek(chatId);
      return [chatId, value?.dek ?? null] as const;
    })
  );
  const fallbackMap = new Map(fallbackEntries);

  const decryptedEntries = chats.map((chat) => {
    if (chat.dekWrapped) {
      try {
        return [
          chat.id,
          unwrapDek(chat.dekWrapped, chat.dekKekId ?? null),
        ] as const;
      } catch {
        return [chat.id, null] as const;
      }
    }
    return [chat.id, fallbackMap.get(chat.id) ?? null] as const;
  });
  const dekByChatId = new Map(decryptedEntries);

  return chats.map((chat) => {
    const dek = dekByChatId.get(chat.id);
    if (!dek) {
      return {
        ...chat,
        messages: chat.messages.map((message) => {
          const {
            cipherText: _cipherText,
            iv: _iv,
            authTag: _authTag,
            algo: _algo,
            encVersion: _encVersion,
            ...safeMessage
          } = message as typeof message & { algo?: string | null; encVersion?: number | null };

          return {
            ...safeMessage,
            content: message.deletedForEveryone ? null : message.content ?? message.text ?? null,
          };
        }),
      };
    }

    return {
      ...chat,
      messages: chat.messages.map((message) => {
        const {
          cipherText: _cipherText,
          iv: _iv,
          authTag: _authTag,
          algo: _algo,
          encVersion: _encVersion,
          ...safeMessage
        } = message as typeof message & { algo?: string | null; encVersion?: number | null };

        if (message.deletedForEveryone) {
          return {
            ...safeMessage,
            content: null,
          };
        }

        if (message.cipherText && message.iv && message.authTag) {
          try {
            return {
              ...safeMessage,
              content: decryptText(
                {
                  cipherTextB64: message.cipherText,
                  ivB64: message.iv,
                  authTagB64: message.authTag,
                  algo: "A256GCM",
                },
                dek
              ),
            };
          } catch {
            return {
              ...safeMessage,
              content: "[Message unavailable]",
            };
          }
        }

        return {
          ...safeMessage,
          content: message.content ?? message.text ?? null,
        };
      }),
    };
  });
};

const assertParticipant = async (userId: string, chatId: string) => {
  const participant = await prisma.chatParticipant.findUnique({
    where: { userId_chatId: { userId, chatId } },
  });
  if (!participant) {
    throw new AppError(403, "Not a chat participant");
  }

  return participant;
};

const getUnreadCountByParticipant = async (participant: { chatId: string; userId: string; lastReadAt: Date }) => {
  return prisma.message.count({
    where: {
      chatId: participant.chatId,
      kind: "USER",
      senderId: { not: participant.userId },
      createdAt: { gt: participant.lastReadAt },
      deletedForEveryone: false,
      hiddenBy: {
        none: {
          userId: participant.userId,
        },
      },
    },
  });
};

const getUnreadCountForChat = async (userId: string, chatId: string) => {
  const participant = await assertParticipant(userId, chatId);
  return getUnreadCountByParticipant(participant);
};

const getTotalUnread = async (userId: string) => {
  const participants = await prisma.chatParticipant.findMany({
    where: { userId },
    select: { chatId: true, userId: true, lastReadAt: true },
  });

  if (participants.length === 0) {
    return 0;
  }

  const counts = await Promise.all(participants.map((participant) => getUnreadCountByParticipant(participant)));
  return counts.reduce((total, count) => total + count, 0);
};

const getUnreadSummary = async (userId: string) => {
  const participants = await prisma.chatParticipant.findMany({
    where: { userId },
    select: {
      chatId: true,
      userId: true,
      lastReadAt: true,
      chat: {
        select: {
          type: true,
        },
      },
    },
  });

  if (participants.length === 0) {
    return {
      total: 0,
      direct: 0,
      group: 0,
      ai: 0,
    };
  }

  const countsByChat = await Promise.all(
    participants.map(async (participant) => {
      const unreadCount = await getUnreadCountByParticipant(participant);
      return {
        type: participant.chat.type,
        unreadCount,
      };
    })
  );

  const summary = countsByChat.reduce(
    (acc, item) => {
      acc.total += item.unreadCount;
      if (item.type === "DIRECT") acc.direct += item.unreadCount;
      if (item.type === "GROUP") acc.group += item.unreadCount;
      if (item.type === "AI") acc.ai += item.unreadCount;
      return acc;
    },
    {
      total: 0,
      direct: 0,
      group: 0,
      ai: 0,
    }
  );

  return summary;
};

const markChatRead = async (userId: string, chatId: string) => {
  await assertParticipant(userId, chatId);
  const lastReadAt = new Date();

  await prisma.chatParticipant.update({
    where: { userId_chatId: { userId, chatId } },
    data: { lastReadAt },
  });

  return { chatId, lastReadAt };
};

const getChatParticipantUserIds = async (chatId: string) => {
  const participants = await prisma.chatParticipant.findMany({
    where: { chatId },
    select: { userId: true },
  });

  return participants.map((participant) => participant.userId);
};

const createDirect = async (userId: string, otherUserId: string) => {
  if (!otherUserId || userId === otherUserId) {
    throw new AppError(400, "Invalid target user");
  }

  const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
  if (!otherUser) {
    throw new AppError(404, "User not found");
  }

  if (await privacyGuard.isBlocked(userId, otherUserId)) {
    throw new AppError(403, "You cannot message this user");
  }

  const possible = await prisma.chat.findMany({
    where: {
      type: "DIRECT",
      participants: { some: { userId } },
      AND: [{ participants: { some: { userId: otherUserId } } }],
    },
    include: {
      _count: { select: { participants: true } },
      participants: {
        select: {
          id: true,
          userId: true,
          lastReadAt: true,
          pinned: true,
          pinnedAt: true,
          archived: true,
          archivedAt: true,
          customOrder: true,
          user: { select: { id: true, username: true, name: true, avatar: true } },
        },
      },
      messages: { take: 1, orderBy: { createdAt: "desc" }, include: lastMessageInclude },
    },
  });

  const existing = possible.find((chat) => chat._count.participants === 2);
  if (existing) {
    const [decryptedExisting] = await decryptLastMessagesForChats([existing]);
    const viewerParticipant =
      decryptedExisting.participants.find((participant) => participant.userId === userId) ?? null;
    return {
      ...stripChatEncryptionFields(decryptedExisting),
      group: null,
      unreadCount: 0,
      viewerParticipant,
    };
  }

  const allowed = await privacyGuard.canMessage(userId, otherUserId);
  if (!allowed) {
    throw new AppError(403, "This user only accepts messages from contacts.");
  }

  const dek = generateDek();
  const wrapped = wrapDek(dek);
  const created = await prisma.chat.create({
    data: {
      type: "DIRECT",
      encVersion: 1,
      dekWrapped: wrapped.dekWrappedB64,
      dekKekId: wrapped.kekId,
      participants: {
        create: [{ userId }, { userId: otherUserId }],
      },
    },
    include: {
      participants: {
        select: {
          id: true,
          userId: true,
          lastReadAt: true,
          pinned: true,
          pinnedAt: true,
          archived: true,
          archivedAt: true,
          customOrder: true,
          user: { select: { id: true, username: true, name: true, avatar: true } },
        },
      },
      messages: { take: 1, orderBy: { createdAt: "desc" }, include: lastMessageInclude },
    },
  });
  const [decryptedCreated] = await decryptLastMessagesForChats([created]);

  const viewerParticipant =
    decryptedCreated.participants.find((participant) => participant.userId === userId) ?? null;

  return {
    ...stripChatEncryptionFields(decryptedCreated),
    group: null,
    unreadCount: 0,
    viewerParticipant,
  };
};

const getChats = async (userId: string) => {
  const myParticipants = await prisma.chatParticipant.findMany({
    where: { userId },
    select: {
      chatId: true,
      userId: true,
      lastReadAt: true,
      pinned: true,
      pinnedAt: true,
      archived: true,
      archivedAt: true,
      customOrder: true,
    },
  });

  const participantMap = new Map(myParticipants.map((participant) => [participant.chatId, participant]));

  const chats = await prisma.chat.findMany({
    where: {
      participants: { some: { userId } },
    },
    include: {
      participants: {
        select: {
          id: true,
          userId: true,
          lastReadAt: true,
          pinned: true,
          pinnedAt: true,
          archived: true,
          archivedAt: true,
          customOrder: true,
          user: { select: { id: true, username: true, name: true, avatar: true } },
        },
      },
      messages: { take: 1, orderBy: { createdAt: "desc" }, include: lastMessageInclude },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  const withGroups = await withGroupInfo(chats);
  const withDecryptedMessages = await decryptLastMessagesForChats(withGroups);
  const unreadCountEntries = await Promise.all(
    withDecryptedMessages.map(async (chat) => {
      const participant = participantMap.get(chat.id);
      if (!participant) return [chat.id, 0] as const;

      const unreadCount = await getUnreadCountByParticipant(participant);
      return [chat.id, unreadCount] as const;
    })
  );
  const unreadCountMap = new Map(unreadCountEntries);

  return withDecryptedMessages.map((chat) => ({
    ...stripChatEncryptionFields(chat),
    unreadCount: unreadCountMap.get(chat.id) ?? 0,
    viewerParticipant: participantMap.get(chat.id) ?? null,
  }));
};

const togglePinChat = async (userId: string, chatId: string) => {
  const participant = await assertParticipant(userId, chatId);
  const shouldPin = !participant.pinned;

  if (shouldPin && participant.archived) {
    throw new AppError(400, "Cannot pin an archived chat");
  }

  if (shouldPin) {
    const pinnedCount = await prisma.chatParticipant.count({
      where: { userId, pinned: true, archived: false },
    });
    if (pinnedCount >= MAX_PINNED_CHATS) {
      throw new AppError(400, `Pinned chat limit is ${MAX_PINNED_CHATS}`);
    }
  }

  const updated = await prisma.chatParticipant.update({
    where: { userId_chatId: { userId, chatId } },
    data: shouldPin
      ? {
          pinned: true,
          pinnedAt: new Date(),
        }
      : {
          pinned: false,
          pinnedAt: null,
        },
    select: {
      chatId: true,
      pinned: true,
      pinnedAt: true,
      archived: true,
      archivedAt: true,
      customOrder: true,
    },
  });

  return updated;
};

const archiveChat = async (userId: string, chatId: string) => {
  await assertParticipant(userId, chatId);
  const updated = await prisma.chatParticipant.update({
    where: { userId_chatId: { userId, chatId } },
    data: {
      archived: true,
      archivedAt: new Date(),
      pinned: false,
      pinnedAt: null,
    },
    select: {
      chatId: true,
      pinned: true,
      pinnedAt: true,
      archived: true,
      archivedAt: true,
      customOrder: true,
    },
  });

  return updated;
};

const unarchiveChat = async (userId: string, chatId: string) => {
  await assertParticipant(userId, chatId);
  const updated = await prisma.chatParticipant.update({
    where: { userId_chatId: { userId, chatId } },
    data: {
      archived: false,
      archivedAt: null,
    },
    select: {
      chatId: true,
      pinned: true,
      pinnedAt: true,
      archived: true,
      archivedAt: true,
      customOrder: true,
    },
  });

  return updated;
};

const reorderChats = async (
  userId: string,
  orders: Array<{
    chatId: string;
    order: number;
  }>
) => {
  const uniqueByChat = new Map<string, number>();
  orders.forEach((item) => {
    if (!item.chatId) return;
    uniqueByChat.set(item.chatId, item.order);
  });
  const entries = Array.from(uniqueByChat.entries()).map(([chatId, order]) => ({
    chatId,
    order,
  }));
  if (entries.length === 0) {
    throw new AppError(400, "orders is required");
  }

  const chatIds = entries.map((item) => item.chatId);
  const participants = await prisma.chatParticipant.findMany({
    where: { userId, chatId: { in: chatIds } },
    select: { chatId: true, archived: true, pinned: true },
  });

  if (participants.length !== chatIds.length) {
    throw new AppError(403, "One or more chats are not accessible");
  }

  if (participants.some((participant) => participant.archived || participant.pinned)) {
    throw new AppError(400, "Only unpinned active chats can be reordered");
  }

  await prisma.$transaction(
    entries.map((item) =>
      prisma.chatParticipant.update({
        where: { userId_chatId: { userId, chatId: item.chatId } },
        data: { customOrder: item.order },
      })
    )
  );

  return { updatedCount: entries.length };
};

const leaveChat = async (userId: string, chatId: string) => {
  await assertParticipant(userId, chatId);

  await prisma.$transaction(async (tx) => {
    await tx.chatParticipant.delete({
      where: {
        userId_chatId: { userId, chatId },
      },
    });

    const count = await tx.chatParticipant.count({ where: { chatId } });
    if (count === 0) {
      await tx.chat.delete({ where: { id: chatId } });
    }
  });

  return { ok: true };
};

const shareChat = async (userId: string, chatId: string) => {
  await assertParticipant(userId, chatId);
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      participants: {
        select: {
          userId: true,
          user: { select: { id: true, username: true, name: true, avatar: true } },
        },
      },
    },
  });

  if (!chat) throw new AppError(404, "Chat not found");

  return {
    chatId: chat.id,
    type: chat.type,
    participants: chat.participants,
  };
};

export const chatService = {
  assertParticipant,
  archiveChat,
  createDirect,
  getChatParticipantUserIds,
  getChats,
  getUnreadSummary,
  getTotalUnread,
  getUnreadCountForChat,
  leaveChat,
  markChatRead,
  reorderChats,
  shareChat,
  togglePinChat,
  unarchiveChat,
};
