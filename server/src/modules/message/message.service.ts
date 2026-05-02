import { MessageKind, MessageStatus, MessageType, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { chatService } from "../chat/chat.service";
import { estimateMediaSizeBytes, inferMediaKind } from "../media/media-metadata";
import { privacyGuard } from "../privacy/privacy.guard";
import { getChatDek, getOrCreateChatDek } from "../../security/chatEncryption.service";
import { decryptText, encryptText } from "../../security/messageCrypto";
import {
  buildReactionSummary,
  buildReactionSummaryMap,
  getMessageReactionDetails,
} from "./reaction.service";

export type DeleteScope = "ME" | "EVERYONE";

const DELETE_FOR_EVERYONE_WINDOW_MINUTES: number | null = null;

const replyToSelect = {
  id: true,
  type: true,
  content: true,
  cipherText: true,
  iv: true,
  authTag: true,
  mediaUrl: true,
  deletedForEveryone: true,
  senderId: true,
  createdAt: true,
  sender: {
    select: {
      id: true,
      name: true,
      username: true,
    },
  },
} as const;

const messageInclude = {
  sender: {
    select: {
      id: true,
      username: true,
      name: true,
      avatar: true,
    },
  },
  replyTo: {
    select: replyToSelect,
  },
} as const;

type MessageWithRelations = Prisma.MessageGetPayload<{
  include: typeof messageInclude;
}>;

const decryptField = (message: {
  cipherText: string | null;
  iv: string | null;
  authTag: string | null;
  content: string | null;
  text: string | null;
}, dek: Buffer | null) => {
  if (message.cipherText && message.iv && message.authTag) {
    if (!dek) {
      return {
        value: null as string | null,
        decryptError: true,
      };
    }
    try {
      return {
        value: decryptText(
          {
            cipherTextB64: message.cipherText,
            ivB64: message.iv,
            authTagB64: message.authTag,
            algo: "A256GCM",
          },
          dek
        ),
        decryptError: false,
      };
    } catch {
      return {
        value: null as string | null,
        decryptError: true,
      };
    }
  }

  return {
    value: message.content ?? message.text ?? null,
    decryptError: false,
  };
};

const withDecryptedMessage = (message: MessageWithRelations, dek: Buffer | null) => {
  const {
    cipherText: _cipherText,
    iv: _iv,
    authTag: _authTag,
    algo: _algo,
    encVersion: _encVersion,
    ...safeMessage
  } = message as MessageWithRelations & {
    algo?: string | null;
    encVersion?: number | null;
  };
  const decryptedContent = message.deletedForEveryone
    ? { value: null as string | null, decryptError: false }
    : decryptField(message, dek);

  const decryptedReply = message.replyTo
    ? message.replyTo.deletedForEveryone
      ? { value: null as string | null, decryptError: false }
      : decryptField(
          {
            content: message.replyTo.content,
            text: message.replyTo.content,
            cipherText: message.replyTo.cipherText ?? null,
            iv: message.replyTo.iv ?? null,
            authTag: message.replyTo.authTag ?? null,
          },
          dek
        )
    : null;

  return {
    ...safeMessage,
    content: decryptedContent.value,
    text: decryptedContent.value,
    decryptError: decryptedContent.decryptError,
    replyTo: message.replyTo
      ? (() => {
          const {
            cipherText: _replyCipherText,
            iv: _replyIv,
            authTag: _replyAuthTag,
            ...safeReply
          } = message.replyTo;
          return {
            ...safeReply,
            content: decryptedReply?.value ?? null,
            decryptError: decryptedReply?.decryptError ?? false,
          };
        })()
      : null,
  };
};

const getDirectChatPeer = async (chatId: string, userId: string) => {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: {
      id: true,
      type: true,
      participants: {
        select: { userId: true },
      },
    },
  });

  if (!chat || chat.type !== "DIRECT") return null;
  const peer = chat.participants.find((participant) => participant.userId !== userId);
  if (!peer) return null;
  return { peerUserId: peer.userId };
};

const assertDirectMessagingAllowed = async (userId: string, chatId: string) => {
  const directPeer = await getDirectChatPeer(chatId, userId);
  if (!directPeer) return;

  if (await privacyGuard.isBlocked(userId, directPeer.peerUserId)) {
    throw new AppError(403, "You cannot message this user");
  }

  const existingUserMessages = await prisma.message.count({
    where: {
      chatId,
      kind: "USER",
    },
  });

  if (existingUserMessages === 0) {
    const canSend = await privacyGuard.canMessage(userId, directPeer.peerUserId);
    if (!canSend) {
      throw new AppError(403, "This user only accepts messages from contacts.");
    }
  }
};

const createMessage = async (input: {
  userId: string;
  chatId: string;
  content?: string;
  mediaUrl?: string;
  type?: MessageType;
  replyToId?: string;
  meta?: Prisma.InputJsonValue;
}) => {
  await chatService.assertParticipant(input.userId, input.chatId);
  await assertDirectMessagingAllowed(input.userId, input.chatId);
  const { dek, encVersion } = await getOrCreateChatDek(input.chatId);

  if (!input.content && !input.mediaUrl) {
    throw new AppError(400, "Either content or mediaUrl is required");
  }

  if (input.replyToId) {
    const repliedMessage = await prisma.message.findUnique({
      where: { id: input.replyToId },
      select: { id: true, chatId: true },
    });

    if (!repliedMessage) {
      throw new AppError(404, "Reply target message not found");
    }

    if (repliedMessage.chatId !== input.chatId) {
      throw new AppError(400, "replyToId must belong to the same chat");
    }
  }

  const message = await prisma.$transaction(async (tx) => {
    const plainContent = input.content ?? null;
    const encryptedContent = plainContent ? encryptText(plainContent, dek) : null;

    const created = (await (tx as any).message.create({
      data: {
        chatId: input.chatId,
        chatType: "DM",
        senderId: input.userId,
        kind: "USER",
        content: encryptedContent ? null : plainContent,
        text: encryptedContent ? null : plainContent,
        cipherText: encryptedContent?.cipherTextB64 ?? null,
        iv: encryptedContent?.ivB64 ?? null,
        authTag: encryptedContent?.authTagB64 ?? null,
        algo: encryptedContent?.algo ?? null,
        encVersion,
        mediaUrl: input.mediaUrl ?? null,
        type: input.type ?? "TEXT",
        replyToId: input.replyToId ?? null,
        meta: input.meta ?? undefined,
      },
      include: messageInclude,
    })) as MessageWithRelations;

    if (created.mediaUrl && created.type !== MessageType.TEXT) {
      await tx.messageMedia.create({
        data: {
          messageId: created.id,
          uploaderId: input.userId,
          kind: inferMediaKind(created.type, created.mediaUrl),
          url: created.mediaUrl,
          sizeBytes: estimateMediaSizeBytes(created.mediaUrl),
        },
      });
    }

    await tx.chat.update({
      where: { id: input.chatId },
      data: { lastMessageAt: created.createdAt },
    });

    return created;
  });

  const decryptedMessage = withDecryptedMessage(message, dek);
  const reactionSummary = await buildReactionSummary(message.id, input.userId);
  return {
    ...decryptedMessage,
    reactionSummary,
  };
};

const getChatMessages = async (input: {
  userId: string;
  chatId: string;
  cursor?: string;
  limit?: number;
}) => {
  await chatService.assertParticipant(input.userId, input.chatId);

  const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
  const hiddenRows = await prisma.messageHidden.findMany({
    where: {
      userId: input.userId,
      message: { chatId: input.chatId },
    },
    select: { messageId: true },
  });
  const hiddenMessageIds = hiddenRows.map((item) => item.messageId);

  const messages = await prisma.message.findMany({
    where: {
      chatId: input.chatId,
      ...(hiddenMessageIds.length > 0 ? { id: { notIn: hiddenMessageIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: messageInclude,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  const hasNext = messages.length > limit;
  const items = hasNext ? messages.slice(0, limit) : messages;
  const summaryMap = await buildReactionSummaryMap(
    items.map((item) => item.id),
    input.userId
  );
  const chatDek = await getChatDek(input.chatId);
  const dek = chatDek?.dek ?? null;
  const nextCursor = hasNext ? items[items.length - 1]?.id : null;

  return {
    items: items.map((item) => ({
      ...withDecryptedMessage(item, dek),
      reactionSummary: summaryMap.get(item.id) ?? [],
    })),
    nextCursor,
  };
};

const markChatRead = async (userId: string, chatId: string) => {
  await chatService.assertParticipant(userId, chatId);

  const result = await prisma.message.updateMany({
    where: {
      chatId,
      senderId: { not: userId },
      status: { not: MessageStatus.READ },
    },
    data: { status: MessageStatus.READ },
  });

  return { updatedCount: result.count };
};

const forwardMessages = async (input: {
  userId: string;
  messageIds: string[];
  targetChatIds: string[];
}) => {
  const messageIds = Array.from(new Set(input.messageIds.filter(Boolean)));
  const targetChatIds = Array.from(new Set(input.targetChatIds.filter(Boolean)));

  if (!messageIds.length) {
    throw new AppError(400, "messageIds is required");
  }

  if (!targetChatIds.length) {
    throw new AppError(400, "targetChatIds is required");
  }

  const sourceMessages = await prisma.message.findMany({
    where: { id: { in: messageIds } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  if (sourceMessages.length !== messageIds.length) {
    throw new AppError(404, "One or more source messages were not found");
  }

  await Promise.all(
    sourceMessages.map((message) => chatService.assertParticipant(input.userId, message.chatId))
  );

  if (sourceMessages.some((message) => message.deletedForEveryone)) {
    throw new AppError(400, "Deleted messages cannot be forwarded");
  }

  await Promise.all(
    targetChatIds.map(async (chatId) => {
      await chatService.assertParticipant(input.userId, chatId);
      await assertDirectMessagingAllowed(input.userId, chatId);
    })
  );

  const sourceDekEntries = await Promise.all(
    Array.from(new Set(sourceMessages.map((message) => message.chatId))).map(async (chatId) => {
      const value = await getChatDek(chatId);
      return [chatId, value?.dek ?? null] as const;
    })
  );
  const sourceDekByChatId = new Map(sourceDekEntries);

  const createdMessages = await prisma.$transaction(async (tx) => {
    const dekByChatId = new Map<string, { dek: Buffer; encVersion: number }>();
    const getDekForChat = async (chatId: string) => {
      const existing = dekByChatId.get(chatId);
      if (existing) return existing;
      const value = await getOrCreateChatDek(chatId);
      dekByChatId.set(chatId, value);
      return value;
    };

    const created: MessageWithRelations[] = [];

    for (const targetChatId of targetChatIds) {
      let latestCreatedAt: Date | null = null;
      const { dek, encVersion } = await getDekForChat(targetChatId);
      for (const source of sourceMessages) {
        const sourceDek = sourceDekByChatId.get(source.chatId);
        const sourceText =
          source.cipherText && source.iv && source.authTag && sourceDek
            ? decryptText(
                {
                  cipherTextB64: source.cipherText,
                  ivB64: source.iv,
                  authTagB64: source.authTag,
                  algo: "A256GCM",
                },
                sourceDek
              )
            : source.content ?? source.text ?? null;
        const encryptedContent = sourceText ? encryptText(sourceText, dek) : null;
        const item = await tx.message.create({
          data: {
            chatId: targetChatId,
            chatType: "DM",
            senderId: input.userId,
            kind: "USER",
            content: encryptedContent ? null : sourceText,
            text: encryptedContent ? null : sourceText,
            cipherText: encryptedContent?.cipherTextB64 ?? null,
            iv: encryptedContent?.ivB64 ?? null,
            authTag: encryptedContent?.authTagB64 ?? null,
            algo: encryptedContent?.algo ?? null,
            encVersion,
            mediaUrl: source.mediaUrl,
            type: source.type,
            isForwarded: true,
            forwardFromMessageId: source.id,
            forwardFromSenderId: source.senderId,
          },
          include: messageInclude,
        });

        if (item.mediaUrl && item.type !== MessageType.TEXT) {
          await tx.messageMedia.create({
            data: {
              messageId: item.id,
              uploaderId: input.userId,
              kind: inferMediaKind(item.type, item.mediaUrl),
              url: item.mediaUrl,
              sizeBytes: estimateMediaSizeBytes(item.mediaUrl),
            },
          });
        }

        created.push(item);
        latestCreatedAt = item.createdAt;
      }

      if (latestCreatedAt) {
        await tx.chat.update({
          where: { id: targetChatId },
          data: { lastMessageAt: latestCreatedAt },
        });
      }
    }

    return created;
  });

  const summaryMap = await buildReactionSummaryMap(
    createdMessages.map((item) => item.id),
    input.userId
  );
  const chatDekEntries = await Promise.all(
    Array.from(new Set(createdMessages.map((item) => item.chatId))).map(async (chatId) => {
      const value = await getChatDek(chatId);
      return [chatId, value?.dek ?? null] as const;
    })
  );
  const dekByChatId = new Map(chatDekEntries);
  return createdMessages.map((item) => ({
    ...withDecryptedMessage(item, dekByChatId.get(item.chatId) ?? null),
    reactionSummary: summaryMap.get(item.id) ?? [],
  }));
};

const isInsideDeleteWindow = (createdAt: Date) => {
  if (DELETE_FOR_EVERYONE_WINDOW_MINUTES === null) {
    return true;
  }

  const cutoff = Date.now() - DELETE_FOR_EVERYONE_WINDOW_MINUTES * 60 * 1000;
  return createdAt.getTime() >= cutoff;
};

const deleteMessages = async (input: {
  userId: string;
  messageIds: string[];
  scope: DeleteScope;
}) => {
  const messageIds = Array.from(new Set(input.messageIds.filter(Boolean)));
  if (messageIds.length === 0) {
    throw new AppError(400, "messageIds is required");
  }

  const messages = await prisma.message.findMany({
    where: { id: { in: messageIds } },
    select: {
      id: true,
      chatId: true,
      senderId: true,
      createdAt: true,
      deletedForEveryone: true,
    },
  });

  const messagesById = new Map(messages.map((message) => [message.id, message]));
  const uniqueChatIds = Array.from(new Set(messages.map((message) => message.chatId)));
  const participants = await prisma.chatParticipant.findMany({
    where: {
      userId: input.userId,
      chatId: { in: uniqueChatIds },
    },
    select: { chatId: true },
  });
  const participantChatIds = new Set(participants.map((participant) => participant.chatId));

  const allowedIds: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  for (const messageId of messageIds) {
    const message = messagesById.get(messageId);
    if (!message) {
      failed.push({ id: messageId, reason: "NOT_FOUND" });
      continue;
    }

    if (!participantChatIds.has(message.chatId)) {
      failed.push({ id: messageId, reason: "FORBIDDEN" });
      continue;
    }

    if (input.scope === "ME") {
      allowedIds.push(message.id);
      continue;
    }

    if (!message.senderId || message.senderId !== input.userId) {
      failed.push({ id: messageId, reason: "FORBIDDEN" });
      continue;
    }

    if (!isInsideDeleteWindow(message.createdAt)) {
      failed.push({ id: messageId, reason: "WINDOW_EXPIRED" });
      continue;
    }

    if (message.deletedForEveryone) {
      failed.push({ id: messageId, reason: "ALREADY_DELETED" });
      continue;
    }

    allowedIds.push(message.id);
  }

  if (input.scope === "ME") {
    if (allowedIds.length > 0) {
      await prisma.messageHidden.createMany({
        data: allowedIds.map((messageId) => ({
          userId: input.userId,
          messageId,
        })),
        skipDuplicates: true,
      });
    }

    return {
      scope: input.scope,
      deletedMessageIds: allowedIds,
      deletedMessages: [] as Array<{
        id: string;
        chatId: string;
        deletedForEveryone: boolean;
        deletedAt: Date | null;
        deletedById: string | null;
      }>,
      failed,
      byChat: [] as Array<{ chatId: string; messageIds: string[] }>,
    };
  }

  const now = new Date();
  if (allowedIds.length > 0) {
    await prisma.message.updateMany({
      where: {
        id: { in: allowedIds },
      },
      data: {
        deletedForEveryone: true,
        deletedAt: now,
        deletedById: input.userId,
        content: null,
        text: null,
        cipherText: null,
        iv: null,
        authTag: null,
        algo: null,
        encVersion: null,
        mediaUrl: null,
        type: "TEXT",
      },
    });
  }

  const deletedMessages = allowedIds.length
    ? await prisma.message.findMany({
        where: { id: { in: allowedIds } },
        select: {
          id: true,
          chatId: true,
          deletedForEveryone: true,
          deletedAt: true,
          deletedById: true,
        },
      })
    : [];

  const byChatMap = new Map<string, string[]>();
  deletedMessages.forEach((message) => {
    const existing = byChatMap.get(message.chatId) ?? [];
    existing.push(message.id);
    byChatMap.set(message.chatId, existing);
  });

  return {
    scope: input.scope,
    deletedMessageIds: allowedIds,
    deletedMessages,
    failed,
    byChat: Array.from(byChatMap.entries()).map(([chatId, ids]) => ({
      chatId,
      messageIds: ids,
    })),
  };
};

const deleteMessage = async (userId: string, messageId: string) => {
  const result = await deleteMessages({
    userId,
    messageIds: [messageId],
    scope: "ME",
  });

  if (result.deletedMessageIds.length > 0) {
    return { ok: true };
  }

  const failure = result.failed[0];
  if (!failure) {
    throw new AppError(500, "Failed to delete message");
  }

  if (failure.reason === "NOT_FOUND") {
    throw new AppError(404, "Message not found");
  }

  if (failure.reason === "FORBIDDEN") {
    throw new AppError(403, "Not allowed to delete this message");
  }

  throw new AppError(400, "Failed to delete message");
};

const toggleReaction = async (input: {
  userId: string;
  messageId: string;
  emoji: string;
}) => {
  const emoji = input.emoji.trim();
  if (!emoji) {
    throw new AppError(400, "emoji is required");
  }

  const message = await prisma.message.findUnique({
    where: { id: input.messageId },
    select: {
      id: true,
      chatId: true,
      groupId: true,
      chatType: true,
      kind: true,
    },
  });

  if (!message) {
    throw new AppError(404, "Message not found");
  }

  await chatService.assertParticipant(input.userId, message.chatId);
  if (message.kind !== MessageKind.USER) {
    throw new AppError(400, "Cannot react to system message");
  }

  const existing = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId: message.id,
        userId: input.userId,
        emoji,
      },
    },
    select: { id: true },
  });

  let action: "ADDED" | "REMOVED" = "ADDED";
  if (existing) {
    await prisma.messageReaction.delete({
      where: { id: existing.id },
    });
    action = "REMOVED";
  } else {
    await prisma.messageReaction.create({
      data: {
        messageId: message.id,
        userId: input.userId,
        emoji,
      },
    });
  }

  const summary = await buildReactionSummary(message.id, input.userId);

  return {
    messageId: message.id,
    chatId: message.chatId,
    groupId: message.groupId,
    chatType: message.chatType,
    emoji,
    action,
    summary,
  };
};

const getReactions = async (input: { userId: string; messageId: string }) => {
  const message = await prisma.message.findUnique({
    where: { id: input.messageId },
    select: {
      id: true,
      chatId: true,
    },
  });
  if (!message) {
    throw new AppError(404, "Message not found");
  }

  await chatService.assertParticipant(input.userId, message.chatId);
  const reactions = await getMessageReactionDetails(message.id);

  return {
    messageId: message.id,
    reactions,
  };
};

export const messageService = {
  createMessage,
  getChatMessages,
  markChatRead,
  forwardMessages,
  deleteMessages,
  deleteMessage,
  toggleReaction,
  getReactions,
};
