import { PrivacyAudience } from "@prisma/client";
import { prisma } from "../../config/prisma";

const hasExistingDirectChat = async (aUserId: string, bUserId: string) => {
  const count = await prisma.chat.count({
    where: {
      type: "DIRECT",
      participants: { some: { userId: aUserId } },
      AND: [{ participants: { some: { userId: bUserId } } }],
    },
  });

  return count > 0;
};

export const isBlocked = async (aUserId: string, bUserId: string) => {
  if (!aUserId || !bUserId) return false;
  const row = await prisma.userBlock.findFirst({
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

export const canMessage = async (senderId: string, receiverId: string) => {
  if (await isBlocked(senderId, receiverId)) return false;

  const receiverSettings = await prisma.userSettings.findUnique({
    where: { userId: receiverId },
    select: { allowMessagesFromNonContacts: true },
  });

  if (!receiverSettings || receiverSettings.allowMessagesFromNonContacts) {
    return true;
  }

  return hasExistingDirectChat(senderId, receiverId);
};

export const canViewByAudience = async (
  viewerId: string,
  ownerId: string,
  audience: PrivacyAudience
) => {
  if (!viewerId || !ownerId) return false;
  if (viewerId === ownerId) return true;
  if (await isBlocked(viewerId, ownerId)) return false;

  if (audience === PrivacyAudience.EVERYONE) return true;
  if (audience === PrivacyAudience.NOBODY) return false;

  return hasExistingDirectChat(viewerId, ownerId);
};

export const shouldBroadcastReadReceipts = async (userId: string) => {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { readReceiptsEnabled: true },
  });

  return settings?.readReceiptsEnabled ?? true;
};

export const privacyGuard = {
  isBlocked,
  canMessage,
  canViewByAudience,
  shouldBroadcastReadReceipts,
};
