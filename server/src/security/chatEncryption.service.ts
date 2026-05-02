import { prisma } from "../config/prisma";
import { generateDek, unwrapDek, wrapDek } from "./messageCrypto";

export const getOrCreateChatDek = async (chatId: string) => {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: {
      id: true,
      dekWrapped: true,
      dekKekId: true,
      encVersion: true,
    },
  });

  if (!chat) {
    throw new Error("Chat not found");
  }

  if (chat.dekWrapped) {
    return {
      dek: unwrapDek(chat.dekWrapped, chat.dekKekId),
      encVersion: chat.encVersion,
    };
  }

  const dek = generateDek();
  const wrapped = wrapDek(dek);
  await prisma.chat.updateMany({
    where: { id: chatId, dekWrapped: null },
    data: {
      dekWrapped: wrapped.dekWrappedB64,
      dekKekId: wrapped.kekId,
      encVersion: 1,
    },
  });

  const refreshed = await prisma.chat.findUnique({
    where: { id: chatId },
    select: {
      dekWrapped: true,
      dekKekId: true,
      encVersion: true,
    },
  });

  if (!refreshed?.dekWrapped) {
    throw new Error("Failed to initialize chat encryption key");
  }

  return {
    dek: unwrapDek(refreshed.dekWrapped, refreshed.dekKekId),
    encVersion: refreshed.encVersion,
  };
};

export const getChatDek = async (chatId: string) => {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: {
      dekWrapped: true,
      dekKekId: true,
      encVersion: true,
    },
  });

  if (!chat?.dekWrapped) {
    return null;
  }

  return {
    dek: unwrapDek(chat.dekWrapped, chat.dekKekId),
    encVersion: chat.encVersion,
  };
};
