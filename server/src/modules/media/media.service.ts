import { prisma } from "../../config/prisma";
import { getChatDek } from "../../security/chatEncryption.service";
import { decryptText } from "../../security/messageCrypto";
import { chatService } from "../chat/chat.service";

const getChatMedia = async (
  userId: string,
  chatId: string,
  filter: "THIS_CHAT" | "ALL_MEDIA"
) => {
  await chatService.assertParticipant(userId, chatId);
  const toSafeMediaMessages = async <T extends Array<{
    chatId: string;
    content: string | null;
    text?: string | null;
    deletedForEveryone: boolean;
    cipherText?: string | null;
    iv?: string | null;
    authTag?: string | null;
  }>>(messages: T) => {
    const dekEntries = await Promise.all(
      Array.from(new Set(messages.map((message) => message.chatId))).map(async (id) => {
        const value = await getChatDek(id);
        return [id, value?.dek ?? null] as const;
      })
    );
    const dekByChatId = new Map(dekEntries);

    return messages.map((message) => {
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
          decryptError: false,
        };
      }

      const dek = dekByChatId.get(message.chatId);
      if (!dek) {
        return {
          ...safeMessage,
          content: message.content ?? message.text ?? null,
          decryptError: false,
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
            decryptError: false,
          };
        } catch {
          return {
            ...safeMessage,
            content: null,
            decryptError: true,
          };
        }
      }

      return {
        ...safeMessage,
        content: message.content ?? message.text ?? null,
        decryptError: false,
      };
    });
  };

  if (filter === "ALL_MEDIA") {
    const participantChats = await prisma.chatParticipant.findMany({
      where: { userId },
      select: { chatId: true },
    });
    const chatIds = participantChats.map((item) => item.chatId);

    if (chatIds.length === 0) {
      return [];
    }

    const messages = await prisma.message.findMany({
      where: {
        chatId: { in: chatIds },
        mediaUrl: { not: null },
        deletedForEveryone: false,
        hiddenBy: {
          none: { userId },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
    return toSafeMediaMessages(messages);
  }

  const messages = await prisma.message.findMany({
    where: {
      chatId,
      mediaUrl: { not: null },
      deletedForEveryone: false,
      hiddenBy: {
        none: { userId },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
        },
      },
    },
  });
  return toSafeMediaMessages(messages);
};

export const mediaService = {
  getChatMedia,
};
