import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";

const listBlocked = async (blockerId: string) => {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId },
    orderBy: { createdAt: "desc" },
    include: {
      blocked: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    userId: row.blocked.id,
    username: row.blocked.username,
    avatar: row.blocked.avatar,
    blockedAt: row.createdAt,
  }));
};

const resolveTargetUserId = async (input: {
  userId?: string;
  username?: string;
}) => {
  const userId = input.userId?.trim();
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new AppError(404, "User not found");
    return user.id;
  }

  const username = input.username?.replace(/^@/, "").trim();
  if (!username) {
    throw new AppError(400, "userId or username is required");
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!user) throw new AppError(404, "User not found");
  return user.id;
};

const blockUser = async (
  blockerId: string,
  input: {
    userId?: string;
    username?: string;
  }
) => {
  const targetId = await resolveTargetUserId(input);
  if (targetId === blockerId) {
    throw new AppError(400, "You cannot block yourself");
  }

  await prisma.userBlock.upsert({
    where: {
      blockerId_blockedId: {
        blockerId,
        blockedId: targetId,
      },
    },
    update: {},
    create: {
      blockerId,
      blockedId: targetId,
    },
  });

  const blocked = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      username: true,
      avatar: true,
    },
  });
  if (!blocked) throw new AppError(404, "User not found");

  return {
    userId: blocked.id,
    username: blocked.username,
    avatar: blocked.avatar,
  };
};

const unblockUser = async (blockerId: string, blockedUserId: string) => {
  const targetId = blockedUserId.trim();
  if (!targetId) throw new AppError(400, "blocked userId is required");

  await prisma.userBlock.deleteMany({
    where: {
      blockerId,
      blockedId: targetId,
    },
  });

  return { unblockedUserId: targetId };
};

export const blocksService = {
  listBlocked,
  blockUser,
  unblockUser,
};
