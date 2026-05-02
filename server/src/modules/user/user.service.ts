import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { privacyGuard } from "../privacy/privacy.guard";
import { PrivacyAudience } from "@prisma/client";
import { creditsService } from "../credits/credits.service";

const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
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
    throw new AppError(404, "User not found");
  }

  const credits = await creditsService.getWalletSummary(user.id);
  const subscriptionActive = await creditsService.hasActiveSubscription(user.id);
  return {
    ...user,
    plan: subscriptionActive ? "PAID" : "FREE",
    subscriptionActive,
    credits,
  };
};

const getNearbyUsers = async (currentUserId: string) => {
  const users = await prisma.user.findMany({
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

  return Promise.all(
    users.map(async (user) => {
      const canViewPhoto = await privacyGuard.canViewByAudience(
        currentUserId,
        user.id,
        user.settings?.profilePhotoAudience ?? PrivacyAudience.EVERYONE
      );
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        avatar: canViewPhoto ? user.avatar : null,
      };
    })
  );
};

const updateMe = async (
  userId: string,
  input: { name?: string; avatar?: string | null; username?: string }
) => {
  if (!input.name && input.avatar === undefined && !input.username) {
    throw new AppError(400, "No updatable fields provided");
  }

  if (input.username) {
    const existing = await prisma.user.findUnique({ where: { username: input.username } });
    if (existing && existing.id !== userId) {
      throw new AppError(409, "Username already taken");
    }
  }

  const updated = await prisma.user.update({
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

  const credits = await creditsService.getWalletSummary(updated.id);
  const subscriptionActive = await creditsService.hasActiveSubscription(updated.id);
  return {
    ...updated,
    plan: subscriptionActive ? "PAID" : "FREE",
    subscriptionActive,
    credits,
  };
};

const deleteMe = async (userId: string) => {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true },
    });
    if (!user) throw new AppError(404, "User not found");

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

export const userService = {
  getMe,
  getNearbyUsers,
  updateMe,
  deleteMe,
};
