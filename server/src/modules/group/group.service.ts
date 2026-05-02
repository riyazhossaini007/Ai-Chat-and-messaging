import {
  GroupRole,
  MessageChatType,
  MessageKind,
  Prisma,
  SystemEvent,
} from "@prisma/client";
import { randomBytes } from "crypto";
import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";
import { estimateMediaSizeBytes, inferMediaKind } from "../media/media-metadata";
import { buildReactionSummaryMap } from "../message/reaction.service";
import { privacyGuard } from "../privacy/privacy.guard";
import { getChatDek, getOrCreateChatDek } from "../../security/chatEncryption.service";
import { decryptText, encryptText, generateDek, wrapDek } from "../../security/messageCrypto";

const DEFAULT_INVITE_TTL_DAYS = 7;
const GROUP_ERROR_CODES = {
  NOT_A_MEMBER: "NOT_A_MEMBER",
  CREATOR_MUST_ASSIGN_ADMIN: "CREATOR_MUST_ASSIGN_ADMIN",
  ALREADY_LEFT: "ALREADY_LEFT",
  GROUP_NOT_FOUND: "GROUP_NOT_FOUND",
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
  systemActor: {
    select: {
      id: true,
      username: true,
      name: true,
      avatar: true,
    },
  },
  reads: {
    select: {
      userId: true,
      user: {
        select: {
          settings: {
            select: {
              readReceiptsEnabled: true,
            },
          },
        },
      },
    },
  },
  replyTo: {
    select: {
      id: true,
      senderId: true,
      kind: true,
      type: true,
      content: true,
      cipherText: true,
      iv: true,
      authTag: true,
      mediaUrl: true,
      deletedForEveryone: true,
      createdAt: true,
      sender: {
        select: {
          id: true,
          username: true,
          name: true,
        },
      },
    },
  },
} as const;

type TxClient = Prisma.TransactionClient;

type MessageWithReadRows = Prisma.MessageGetPayload<{
  include: typeof messageInclude;
}>;

const decryptMessageContent = (
  message: {
    content: string | null;
    text?: string | null;
    cipherText?: string | null;
    iv?: string | null;
    authTag?: string | null;
  },
  dek: Buffer | null
) => {
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
    value: message.content ?? message.text ?? "",
    decryptError: false,
  };
};

const getReadCount = (message: {
  senderId: string | null;
  reads: Array<{ userId: string; user: { settings: { readReceiptsEnabled: boolean } | null } }>;
}) =>
  message.reads.reduce((count, read) => {
    if (read.user.settings?.readReceiptsEnabled === false) return count;
    if (!message.senderId) return count + 1;
    if (read.userId === message.senderId) return count;
    return count + 1;
  }, 0);

const withGroupMessageMeta = (
  message: MessageWithReadRows,
  dek: Buffer | null,
  overrides?: Partial<{
    readCount: number;
    deliveredToAtLeastOne: boolean;
    reactionSummary: Array<{
      emoji: string;
      count: number;
      reactedByMe: boolean;
    }>;
  }>
) => ({
  ...(() => {
    const {
      cipherText: _cipherText,
      iv: _iv,
      authTag: _authTag,
      algo: _algo,
      encVersion: _encVersion,
      ...safeMessage
    } = message;
    return safeMessage;
  })(),
  content: message.deletedForEveryone
    ? null
    : decryptMessageContent(message, dek).value,
  text: message.deletedForEveryone
    ? null
    : decryptMessageContent(message, dek).value,
  decryptError: message.deletedForEveryone
    ? false
    : decryptMessageContent(message, dek).decryptError,
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
        content: message.replyTo.deletedForEveryone
          ? null
          : decryptMessageContent(message.replyTo, dek).value,
        decryptError: message.replyTo.deletedForEveryone
          ? false
          : decryptMessageContent(message.replyTo, dek).decryptError,
        };
      })()
    : null,
  replyToPreview: message.replyTo
    ? {
        id: message.replyTo.id,
        senderId: message.replyTo.senderId,
        senderUsername:
          message.replyTo.sender?.name ??
          message.replyTo.sender?.username ??
          "Member",
        textSnippet: message.replyTo.deletedForEveryone
          ? "This message was deleted."
          : message.replyTo.type === "IMAGE"
          ? "Photo"
          : message.replyTo.type === "VIDEO"
          ? "Video"
          : message.replyTo.type === "FILE"
          ? decryptMessageContent(message.replyTo, dek).value || "Document"
          : decryptMessageContent(message.replyTo, dek).value || "",
        mediaType: message.replyTo.type,
        isDeletedForEveryone: message.replyTo.deletedForEveryone,
        kind: message.replyTo.kind,
      }
    : null,
  readCount: overrides?.readCount ?? getReadCount(message),
  deliveredToAtLeastOne: overrides?.deliveredToAtLeastOne ?? false,
  reactionSummary: overrides?.reactionSummary ?? [],
});

const ensureGroupWithChat = async (groupId: string) => {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      chatId: true,
      title: true,
      creatorId: true,
    },
  });
  if (!group) {
    throw new AppError(404, "Group not found", { code: GROUP_ERROR_CODES.GROUP_NOT_FOUND });
  }
  return group;
};

const getGroupMembership = async (groupId: string, userId: string) =>
  prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { role: true, groupId: true, userId: true, leftAt: true },
  });

const requireGroupRole = async (groupId: string, userId: string) => {
  const member = await getGroupMembership(groupId, userId);
  if (!member) {
    await ensureGroupWithChat(groupId);
    throw new AppError(403, "Not a group member", {
      code: GROUP_ERROR_CODES.NOT_A_MEMBER,
    });
  }
  if (member.leftAt) {
    throw new AppError(403, "Not a group member", {
      code: GROUP_ERROR_CODES.NOT_A_MEMBER,
    });
  }
  return member.role;
};

const requireAtLeastAdmin = async (groupId: string, userId: string) => {
  const role = await requireGroupRole(groupId, userId);
  if (role !== "ADMIN" && role !== "CREATOR") {
    throw new AppError(403, "Insufficient role");
  }
  return role;
};

const requireCreator = async (groupId: string, userId: string) => {
  const role = await requireGroupRole(groupId, userId);
  if (role !== "CREATOR") {
    throw new AppError(403, "Only creator can perform this action");
  }
  return role;
};

const buildSystemText = (input: {
  event: SystemEvent;
  actorName?: string | null;
  targetName?: string | null;
  viaInvite?: boolean;
}) => {
  const actor = input.actorName?.trim() || "System";
  const target = input.targetName?.trim() || "Member";

  switch (input.event) {
    case "MEMBER_JOIN":
      if (input.viaInvite) return `${target} joined via invite link`;
      return `${target} joined the group`;
    case "MEMBER_LEAVE":
      return `${target} left the group`;
    case "MEMBER_ADDED":
      return `Admin ${actor} added ${target}`;
    case "MEMBER_REMOVED":
      return `Admin ${actor} removed ${target}`;
    case "ADMIN_PROMOTED":
      return `${actor} promoted ${target} to Admin`;
    case "ADMIN_DEMOTED":
      return `${actor} removed ${target} from Admin`;
    case "GROUP_UPDATED":
      return `Admin ${actor} updated group description`;
    case "RULES_UPDATED":
      return `Admin ${actor} updated group rules`;
    default:
      return "Group updated";
  }
};

const createSystemMessage = async (
  tx: TxClient,
  input: {
    chatId: string;
    groupId: string;
    event: SystemEvent;
    text: string;
    systemActorId?: string;
    dek: Buffer;
    encVersion: number;
  }
) => {
  const encryptedText = encryptText(input.text, input.dek);
  const message = await tx.message.create({
    data: {
      chatId: input.chatId,
      chatType: MessageChatType.GROUP,
      groupId: input.groupId,
      senderId: null,
      kind: MessageKind.SYSTEM,
      systemEvent: input.event,
      systemActorId: input.systemActorId ?? null,
      text: null,
      content: null,
      cipherText: encryptedText.cipherTextB64,
      iv: encryptedText.ivB64,
      authTag: encryptedText.authTagB64,
      algo: encryptedText.algo,
      encVersion: input.encVersion,
      type: "TEXT",
      status: "SENT",
    },
    include: messageInclude,
  });

  await tx.chat.update({
    where: { id: input.chatId },
    data: { lastMessageAt: message.createdAt },
  });

  return withGroupMessageMeta(message, input.dek, {
    deliveredToAtLeastOne: false,
    reactionSummary: [],
  });
};

const createGroup = async (
  creatorId: string,
  input: {
    title: string;
    avatar?: string | null;
    description?: string | null;
    memberIds?: string[];
  }
) => {
  const title = input.title.trim();
  if (!title) throw new AppError(400, "title is required");

  const uniqueMemberIds = Array.from(
    new Set([creatorId, ...(input.memberIds ?? [])].filter(Boolean))
  );
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueMemberIds } },
    select: { id: true, name: true, username: true },
  });
  if (users.length !== uniqueMemberIds.length) {
    throw new AppError(400, "One or more users are invalid");
  }

  const creator = users.find((item) => item.id === creatorId);
  if (!creator) throw new AppError(400, "Creator not found");

  for (const member of users) {
    if (member.id === creatorId) continue;
    if (await privacyGuard.isBlocked(creatorId, member.id)) {
      throw new AppError(403, `Cannot add ${member.username} due to privacy settings`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const dek = generateDek();
    const wrapped = wrapDek(dek);
    const chat = await tx.chat.create({
      data: {
        type: "GROUP",
        encVersion: 1,
        dekWrapped: wrapped.dekWrappedB64,
        dekKekId: wrapped.kekId,
      },
    });

    const group = await tx.group.create({
      data: {
        title,
        name: title,
        avatar: input.avatar ?? null,
        description: input.description ?? null,
        creatorId,
        chatId: chat.id,
      },
    });

    await tx.groupMember.createMany({
      data: uniqueMemberIds.map((userId) => ({
        userId,
        groupId: group.id,
        role: userId === creatorId ? GroupRole.CREATOR : GroupRole.MEMBER,
      })),
      skipDuplicates: true,
    });

    await tx.chatParticipant.createMany({
      data: uniqueMemberIds.map((userId) => ({ userId, chatId: chat.id })),
      skipDuplicates: true,
    });

    await createSystemMessage(tx, {
      chatId: chat.id,
      groupId: group.id,
      event: "GROUP_UPDATED",
      text: `${creator.name ?? creator.username} created the group`,
      systemActorId: creatorId,
      dek,
      encVersion: 1,
    });

    for (const user of users.filter((item) => item.id !== creatorId)) {
      await createSystemMessage(tx, {
        chatId: chat.id,
        groupId: group.id,
        event: "MEMBER_ADDED",
        text: buildSystemText({
          event: "MEMBER_ADDED",
          actorName: creator.name ?? creator.username,
          targetName: user.name ?? user.username,
        }),
        systemActorId: creatorId,
        dek,
        encVersion: 1,
      });
    }

    const created = await tx.group.findUnique({
      where: { id: group.id },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, name: true, avatar: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!created) throw new AppError(500, "Failed to create group");
    return created;
  });
};

const getMyGroups = async (userId: string) => {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, leftAt: null },
    include: {
      group: {
        include: {
          members: {
            where: { leftAt: null },
            select: { id: true },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: { select: { name: true, username: true } } },
          },
        },
      },
    },
    orderBy: { group: { updatedAt: "desc" } },
  });

  const dekEntries = await Promise.all(
    Array.from(new Set(memberships.map((membership) => membership.group.chatId))).map(
      async (chatId) => {
        const value = await getChatDek(chatId);
        return [chatId, value?.dek ?? null] as const;
      }
    )
  );
  const dekByChatId = new Map(dekEntries);

  const rows = await Promise.all(
    memberships.map(async (membership) => {
      const group = membership.group;
      const last = group.messages[0];
      const dek = dekByChatId.get(group.chatId) ?? null;
      const lastMessagePreview = (() => {
        if (!last) return "";
        const plainText = last.deletedForEveryone
          ? "This message was deleted"
          : decryptMessageContent(last, dek).value ?? "";
        if (last.kind === "SYSTEM") return plainText || "System update";
        const raw = plainText;
        if (!raw) return "Media";
        const senderPrefix =
          last.senderId === userId
            ? "You: "
            : `${last.sender?.name ?? last.sender?.username ?? "Member"}: `;
        return `${senderPrefix}${raw}`;
      })();
      const unseenCount = await prisma.message.count({
        where: {
          chatId: group.chatId,
          kind: "USER",
          createdAt: {
            gt:
              (
                await prisma.chatParticipant.findUnique({
                  where: { userId_chatId: { userId, chatId: group.chatId } },
                  select: { lastReadAt: true },
                })
              )?.lastReadAt ?? new Date(0),
          },
          senderId: { not: userId },
        },
      });

      return {
        id: group.id,
        title: group.title,
        avatar: group.avatar,
        memberCount: group.members.length,
        myRole: membership.role,
        chatId: group.chatId,
        description: group.description,
        rulesText: group.rulesText,
        lastMessagePreview,
        unseenCount,
        updatedAt: group.updatedAt,
      };
    })
  );

  return rows.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
};

const getGroupDetails = async (groupId: string, userId: string) => {
  const myRole = await requireGroupRole(groupId, userId);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        where: { leftAt: null },
        include: {
          user: { select: { id: true, username: true, name: true, avatar: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
      invites: {
        where: { revokedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!group) throw new AppError(404, "Group not found");

  return {
    ...group,
    myRole,
    memberCount: group.members.length,
    invite:
      myRole === "ADMIN" || myRole === "CREATOR"
        ? group.invites[0] ?? null
        : null,
  };
};

const updateGroup = async (
  groupId: string,
  userId: string,
  input: { title?: string; avatar?: string | null; description?: string | null }
) => {
  await requireAtLeastAdmin(groupId, userId);
  const group = await ensureGroupWithChat(groupId);
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true },
  });

  if (!actor) throw new AppError(404, "User not found");

  return prisma.$transaction(async (tx) => {
    const { dek, encVersion } = await getOrCreateChatDek(group.chatId);
    const updated = await tx.group.update({
      where: { id: groupId },
      data: {
        title: input.title?.trim(),
        name: input.title?.trim(),
        avatar: input.avatar,
        description: input.description,
      },
    });

    const systemMessage = await createSystemMessage(tx, {
      chatId: group.chatId,
      groupId,
      event: "GROUP_UPDATED",
      text: buildSystemText({
        event: "GROUP_UPDATED",
        actorName: actor.name ?? actor.username,
      }),
      systemActorId: userId,
      dek,
      encVersion,
    });

    return { group: updated, systemMessage };
  });
};

const updateRules = async (groupId: string, userId: string, rulesText: string) => {
  await requireAtLeastAdmin(groupId, userId);
  const group = await ensureGroupWithChat(groupId);
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true },
  });
  if (!actor) throw new AppError(404, "User not found");

  return prisma.$transaction(async (tx) => {
    const { dek, encVersion } = await getOrCreateChatDek(group.chatId);
    const updated = await tx.group.update({
      where: { id: groupId },
      data: { rulesText },
    });

    const systemMessage = await createSystemMessage(tx, {
      chatId: group.chatId,
      groupId,
      event: "RULES_UPDATED",
      text: buildSystemText({
        event: "RULES_UPDATED",
        actorName: actor.name ?? actor.username,
      }),
      systemActorId: userId,
      dek,
      encVersion,
    });

    return { group: updated, systemMessage };
  });
};

const addMembers = async (groupId: string, userId: string, userIds: string[]) => {
  await requireAtLeastAdmin(groupId, userId);
  const group = await ensureGroupWithChat(groupId);
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) throw new AppError(400, "userIds is required");

  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true },
  });
  if (!actor) throw new AppError(404, "User not found");

  const existingMembers = await prisma.groupMember.findMany({
    where: { groupId, userId: { in: uniqueIds } },
    select: { userId: true, leftAt: true },
  });
  const existingByUserId = new Map(existingMembers.map((item) => [item.userId, item]));
  const alreadyActive = uniqueIds.filter((id) => existingByUserId.get(id)?.leftAt === null);
  const toReactivate = uniqueIds.filter((id) => Boolean(existingByUserId.get(id)?.leftAt));
  const toAdd = uniqueIds.filter((id) => !existingByUserId.has(id));
  const toUpsert = [...toAdd, ...toReactivate];

  const users = await prisma.user.findMany({
    where: { id: { in: toUpsert } },
    select: { id: true, name: true, username: true },
  });
  if (users.length !== toUpsert.length) throw new AppError(400, "One or more users are invalid");

  for (const target of users) {
    if (await privacyGuard.isBlocked(userId, target.id)) {
      throw new AppError(403, `Cannot add ${target.username} due to privacy settings`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const { dek, encVersion } = await getOrCreateChatDek(group.chatId);
    if (toAdd.length > 0) {
      await tx.groupMember.createMany({
        data: toAdd.map((memberUserId) => ({
          groupId,
          userId: memberUserId,
          role: GroupRole.MEMBER,
        })),
      });
    }
    if (toReactivate.length > 0) {
      await tx.groupMember.updateMany({
        where: { groupId, userId: { in: toReactivate } },
        data: { leftAt: null, joinedAt: new Date(), role: GroupRole.MEMBER },
      });
    }
    if (toUpsert.length > 0) {
      await tx.chatParticipant.createMany({
        data: toUpsert.map((memberUserId) => ({ userId: memberUserId, chatId: group.chatId })),
        skipDuplicates: true,
      });
      await tx.chatParticipant.updateMany({
        where: { userId: { in: toUpsert }, chatId: group.chatId },
        data: { archived: false, archivedAt: null },
      });
    }

    const systemMessages = [];
    for (const target of users.filter((item) => !alreadyActive.includes(item.id))) {
      const message = await createSystemMessage(tx, {
        chatId: group.chatId,
        groupId,
        event: "MEMBER_ADDED",
        text: buildSystemText({
          event: "MEMBER_ADDED",
          actorName: actor.name ?? actor.username,
          targetName: target.name ?? target.username,
        }),
        systemActorId: userId,
        dek,
        encVersion,
      });
      systemMessages.push(message);
    }

    return { addedUserIds: toUpsert, systemMessages };
  });
};

const removeMember = async (groupId: string, actorId: string, targetUserId: string) => {
  const actorRole = await requireAtLeastAdmin(groupId, actorId);
  const group = await ensureGroupWithChat(groupId);

  const target = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: targetUserId, groupId } },
    include: {
      user: { select: { id: true, name: true, username: true } },
    },
  });
  if (!target || target.leftAt) throw new AppError(404, "Member not found");

  if (target.role === "CREATOR" && actorRole !== "CREATOR") {
    throw new AppError(403, "Admin cannot remove creator");
  }
  if (target.role === "CREATOR" && actorId === targetUserId) {
    throw new AppError(400, "Creator must transfer ownership before leaving");
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { name: true, username: true },
  });
  if (!actor) throw new AppError(404, "User not found");

  return prisma.$transaction(async (tx) => {
    const { dek, encVersion } = await getOrCreateChatDek(group.chatId);
    await tx.groupMember.update({
      where: { userId_groupId: { userId: targetUserId, groupId } },
      data: { leftAt: new Date() },
    });
    await tx.chatParticipant.deleteMany({
      where: { userId: targetUserId, chatId: group.chatId },
    });

    const systemMessage = await createSystemMessage(tx, {
      chatId: group.chatId,
      groupId,
      event: "MEMBER_REMOVED",
      text: buildSystemText({
        event: "MEMBER_REMOVED",
        actorName: actor.name ?? actor.username,
        targetName: target.user.name ?? target.user.username,
      }),
      systemActorId: actorId,
      dek,
      encVersion,
    });

    return { removedUserId: targetUserId, systemMessage };
  });
};

const leaveGroup = async (
  groupId: string,
  userId: string,
  input?: { newAdminUserId?: string }
) => {
  const group = await ensureGroupWithChat(groupId);
  const membership = await getGroupMembership(groupId, userId);
  if (!membership) {
    throw new AppError(404, "Not a group member", { code: GROUP_ERROR_CODES.NOT_A_MEMBER });
  }
  if (membership.leftAt) {
    throw new AppError(400, "Already left group", { code: GROUP_ERROR_CODES.ALREADY_LEFT });
  }
  const role = membership.role;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true },
  });
  if (!user) throw new AppError(404, "User not found");

  return prisma.$transaction(async (tx) => {
    const { dek, encVersion } = await getOrCreateChatDek(group.chatId);
    let newCreatorUserId: string | null = null;
    let newCreatorPreviousRole: GroupRole | null = null;
    if (role === "CREATOR") {
      const activeMembers = await tx.groupMember.findMany({
        where: { groupId, leftAt: null },
        select: { userId: true, role: true },
      });
      const activeOthers = activeMembers.filter((member) => member.userId !== userId);
      if (activeOthers.length === 0) {
        throw new AppError(400, "Creator cannot leave as the only active member. Delete the group instead.", {
          code: GROUP_ERROR_CODES.CREATOR_MUST_ASSIGN_ADMIN,
        });
      }

      const candidateUserId = input?.newAdminUserId?.trim();
      if (!candidateUserId) {
        throw new AppError(403, "Creator must assign a new admin before leaving", {
          code: GROUP_ERROR_CODES.CREATOR_MUST_ASSIGN_ADMIN,
        });
      }
      const transferMember = activeOthers.find((member) => member.userId === candidateUserId);
      if (!transferMember) {
        throw new AppError(400, "Selected new admin is not an active member");
      }
      if (candidateUserId === userId) throw new AppError(400, "Cannot transfer ownership to self");
      newCreatorUserId = candidateUserId;
      newCreatorPreviousRole = transferMember.role;

      await tx.groupMember.update({
        where: { userId_groupId: { userId, groupId } },
        data: { role: GroupRole.ADMIN },
      });
      await tx.groupMember.update({
        where: { userId_groupId: { userId: candidateUserId, groupId } },
        data: { role: GroupRole.CREATOR },
      });
      await tx.group.update({
        where: { id: groupId },
        data: { creatorId: candidateUserId },
      });
    }

    await tx.groupMember.update({
      where: { userId_groupId: { userId, groupId } },
      data: { leftAt: new Date() },
    });
    await tx.chatParticipant.deleteMany({
      where: { userId, chatId: group.chatId },
    });

    const systemMessage = await createSystemMessage(tx, {
      chatId: group.chatId,
      groupId,
      event: "MEMBER_LEAVE",
      text: buildSystemText({
        event: "MEMBER_LEAVE",
        targetName: user.name ?? user.username,
      }),
      systemActorId: userId,
      dek,
      encVersion,
    });

    return {
      ok: true,
      systemMessage,
      roleTransfer: newCreatorUserId
        ? {
            previousCreatorId: userId,
            newCreatorId: newCreatorUserId,
            newCreatorPreviousRole: newCreatorPreviousRole ?? GroupRole.MEMBER,
          }
        : null,
    };
  });
};

const transferCreator = async (
  groupId: string,
  creatorId: string,
  input: { newCreatorUserId: string }
) => {
  await requireCreator(groupId, creatorId);
  const group = await ensureGroupWithChat(groupId);
  const nextCreatorUserId = input.newCreatorUserId.trim();
  if (!nextCreatorUserId) throw new AppError(400, "newCreatorUserId is required");
  if (nextCreatorUserId === creatorId) {
    throw new AppError(400, "Cannot transfer ownership to self");
  }

  return prisma.$transaction(async (tx) => {
    const candidate = await tx.groupMember.findUnique({
      where: { userId_groupId: { userId: nextCreatorUserId, groupId } },
      select: { userId: true, leftAt: true, role: true },
    });
    if (!candidate || candidate.leftAt) {
      throw new AppError(400, "Selected member is not active");
    }

    await tx.groupMember.update({
      where: { userId_groupId: { userId: creatorId, groupId } },
      data: { role: GroupRole.ADMIN },
    });
    await tx.groupMember.update({
      where: { userId_groupId: { userId: nextCreatorUserId, groupId } },
      data: { role: GroupRole.CREATOR },
    });
    await tx.group.update({
      where: { id: groupId },
      data: { creatorId: nextCreatorUserId },
    });

    const { dek, encVersion } = await getOrCreateChatDek(group.chatId);
    const actor = await tx.user.findUnique({
      where: { id: creatorId },
      select: { name: true, username: true },
    });
    const target = await tx.user.findUnique({
      where: { id: nextCreatorUserId },
      select: { name: true, username: true },
    });

    const systemMessage = await createSystemMessage(tx, {
      chatId: group.chatId,
      groupId,
      event: "ADMIN_PROMOTED",
      text: buildSystemText({
        event: "ADMIN_PROMOTED",
        actorName: actor?.name ?? actor?.username ?? "Creator",
        targetName: target?.name ?? target?.username ?? "Member",
      }),
      systemActorId: creatorId,
      dek,
      encVersion,
    });

    return {
      previousCreatorId: creatorId,
      newCreatorId: nextCreatorUserId,
      newCreatorPreviousRole: candidate.role,
      systemMessage,
    };
  });
};

const setAdminRole = async (
  groupId: string,
  creatorId: string,
  input: { userId: string; action: "PROMOTE" | "DEMOTE" }
) => {
  await requireCreator(groupId, creatorId);
  const group = await ensureGroupWithChat(groupId);
  if (input.userId === creatorId) throw new AppError(400, "Creator role cannot be changed");

  const target = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: input.userId, groupId } },
    include: { user: { select: { name: true, username: true } } },
  });
  if (!target || target.leftAt) throw new AppError(404, "Member not found");
  if (target.role === "CREATOR") throw new AppError(400, "Cannot demote creator");

  const creator = await prisma.user.findUnique({
    where: { id: creatorId },
    select: { name: true, username: true },
  });
  if (!creator) throw new AppError(404, "User not found");

  return prisma.$transaction(async (tx) => {
    const { dek, encVersion } = await getOrCreateChatDek(group.chatId);
    const nextRole = input.action === "PROMOTE" ? GroupRole.ADMIN : GroupRole.MEMBER;
    await tx.groupMember.update({
      where: { userId_groupId: { userId: input.userId, groupId } },
      data: { role: nextRole },
    });

    const event: SystemEvent =
      input.action === "PROMOTE" ? "ADMIN_PROMOTED" : "ADMIN_DEMOTED";
    const systemMessage = await createSystemMessage(tx, {
      chatId: group.chatId,
      groupId,
      event,
      text: buildSystemText({
        event,
        actorName: creator.name ?? creator.username,
        targetName: target.user.name ?? target.user.username,
      }),
      systemActorId: creatorId,
      dek,
      encVersion,
    });

    return { role: nextRole, systemMessage };
  });
};

const issueInvite = async (
  groupId: string,
  userId: string,
  input?: { expiresAt?: string | null }
) => {
  await requireAtLeastAdmin(groupId, userId);
  await ensureGroupWithChat(groupId);

  const expiresAt =
    input?.expiresAt === undefined
      ? new Date(Date.now() + DEFAULT_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
      : input.expiresAt
      ? new Date(input.expiresAt)
      : null;

  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new AppError(400, "Invalid expiresAt");
  }

  const token = randomBytes(24).toString("hex");
  const invite = await prisma.groupInvite.create({
    data: {
      groupId,
      token,
      createdById: userId,
      expiresAt,
    },
  });

  return {
    invite,
    inviteUrl: `/groups/join/${invite.token}`,
  };
};

const revokeInvite = async (groupId: string, userId: string) => {
  await requireAtLeastAdmin(groupId, userId);

  const latest = await prisma.groupInvite.findFirst({
    where: { groupId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return { ok: true, invite: null };

  const invite = await prisma.groupInvite.update({
    where: { id: latest.id },
    data: { revokedAt: new Date() },
  });
  return { ok: true, invite };
};

const joinByInviteToken = async (token: string, userId: string) => {
  const invite = await prisma.groupInvite.findUnique({
    where: { token },
    include: {
      group: {
        select: {
          id: true,
          chatId: true,
        },
      },
    },
  });
  if (!invite) throw new AppError(404, "Invite not found");
  if (invite.revokedAt) throw new AppError(400, "Invite has been revoked");
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    throw new AppError(400, "Invite has expired");
  }

  if (await privacyGuard.isBlocked(userId, invite.createdById)) {
    throw new AppError(403, "Cannot join this group due to privacy settings");
  }

  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: invite.groupId } },
  });
  if (existing && existing.leftAt === null) {
    return { alreadyMember: true, groupId: invite.groupId, message: null };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true },
  });
  if (!user) throw new AppError(404, "User not found");

  return prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.groupMember.update({
        where: { userId_groupId: { userId, groupId: invite.groupId } },
        data: { leftAt: null, joinedAt: new Date(), role: GroupRole.MEMBER },
      });
    } else {
      await tx.groupMember.create({
        data: {
          groupId: invite.groupId,
          userId,
          role: GroupRole.MEMBER,
        },
      });
    }
    await tx.chatParticipant.upsert({
      where: { userId_chatId: { userId, chatId: invite.group.chatId } },
      create: { userId, chatId: invite.group.chatId },
      update: { archived: false, archivedAt: null },
    });

    const message = await createSystemMessage(tx, {
      chatId: invite.group.chatId,
      groupId: invite.groupId,
      event: "MEMBER_JOIN",
      text: buildSystemText({
        event: "MEMBER_JOIN",
        targetName: user.name ?? user.username,
        viaInvite: true,
      }),
      systemActorId: userId,
      ...(await getOrCreateChatDek(invite.group.chatId)),
    });

    return { alreadyMember: false, groupId: invite.groupId, message };
  });
};

const getGroupMessages = async (groupId: string, userId: string, cursor?: string, limit = 50) => {
  await requireGroupRole(groupId, userId);
  const group = await ensureGroupWithChat(groupId);
  const take = Math.max(1, Math.min(limit, 100));

  const items = await prisma.message.findMany({
    where: { groupId, chatId: group.chatId },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: messageInclude,
  });

  const hasNext = items.length > take;
  const sliced = hasNext ? items.slice(0, take) : items;
  const summaryMap = await buildReactionSummaryMap(
    sliced.map((item) => item.id),
    userId
  );
  const chatDek = await getChatDek(group.chatId);
  const dek = chatDek?.dek ?? null;

  return {
    items: sliced.map((item) =>
      withGroupMessageMeta(item, dek, {
        reactionSummary: summaryMap.get(item.id) ?? [],
      })
    ),
    nextCursor: hasNext ? sliced[sliced.length - 1]?.id ?? null : null,
  };
};

const createGroupMessage = async (
  groupId: string,
  userId: string,
  payload: {
    text?: string;
    mediaUrl?: string;
    mediaType?: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
    replyToId?: string | null;
  }
) => {
  await requireGroupRole(groupId, userId);
  const group = await ensureGroupWithChat(groupId);
  const body = payload.text?.trim() ?? "";
  const mediaUrl = payload.mediaUrl?.trim() ?? "";
  const type = payload.mediaType ?? "TEXT";
  if (!["TEXT", "IMAGE", "VIDEO", "FILE"].includes(type)) {
    throw new AppError(400, "Invalid mediaType");
  }
  const hasText = body.length > 0;
  const hasMedia = mediaUrl.length > 0;

  if (!hasText && !hasMedia) {
    throw new AppError(400, "text or mediaUrl is required");
  }

  let replyToId: string | null = payload.replyToId ?? null;
  if (replyToId) {
    const replyTarget = await prisma.message.findFirst({
      where: {
        id: replyToId,
        groupId,
        chatId: group.chatId,
        chatType: MessageChatType.GROUP,
      },
      select: {
        id: true,
        kind: true,
      },
    });
    if (!replyTarget) {
      throw new AppError(400, "Invalid replyToId");
    }
    if (replyTarget.kind !== MessageKind.USER) {
      throw new AppError(400, "Cannot reply to system message");
    }
    replyToId = replyTarget.id;
  }

  return prisma.$transaction(async (tx) => {
    const { dek, encVersion } = await getOrCreateChatDek(group.chatId);
    const encryptedBody = hasText ? encryptText(body, dek) : null;
    const message = await tx.message.create({
      data: {
        chatId: group.chatId,
        chatType: MessageChatType.GROUP,
        groupId,
        senderId: userId,
        kind: MessageKind.USER,
        text: encryptedBody ? null : hasText ? body : null,
        content: encryptedBody ? null : hasText ? body : null,
        cipherText: encryptedBody?.cipherTextB64 ?? null,
        iv: encryptedBody?.ivB64 ?? null,
        authTag: encryptedBody?.authTagB64 ?? null,
        algo: encryptedBody?.algo ?? null,
        encVersion: encryptedBody ? encVersion : null,
        mediaUrl: hasMedia ? mediaUrl : null,
        type,
        replyToId,
      },
      include: messageInclude,
    });

    if (message.mediaUrl && message.type !== "TEXT") {
      await tx.messageMedia.create({
        data: {
          messageId: message.id,
          uploaderId: userId,
          kind: inferMediaKind(message.type, message.mediaUrl),
          url: message.mediaUrl,
          sizeBytes: estimateMediaSizeBytes(message.mediaUrl),
        },
      });
    }

    await tx.chat.update({
      where: { id: group.chatId },
      data: { lastMessageAt: message.createdAt },
    });

    const summaryMap = await buildReactionSummaryMap([message.id], userId);
    return withGroupMessageMeta(message, dek, {
      readCount: 0,
      deliveredToAtLeastOne: false,
      reactionSummary: summaryMap.get(message.id) ?? [],
    });
  });
};

const getGroupMessagesAround = async (
  groupId: string,
  userId: string,
  messageId: string,
  windowSize = 20
) => {
  await requireGroupRole(groupId, userId);
  const group = await ensureGroupWithChat(groupId);
  const target = await prisma.message.findFirst({
    where: {
      id: messageId,
      groupId,
      chatId: group.chatId,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });
  if (!target) throw new AppError(404, "Message not found");

  const take = Math.max(1, Math.min(windowSize, 50));

  const before = await prisma.message.findMany({
    where: {
      groupId,
      chatId: group.chatId,
      createdAt: { lt: target.createdAt },
    },
    orderBy: { createdAt: "desc" },
    take,
    include: messageInclude,
  });

  const after = await prisma.message.findMany({
    where: {
      groupId,
      chatId: group.chatId,
      createdAt: { gt: target.createdAt },
    },
    orderBy: { createdAt: "asc" },
    take,
    include: messageInclude,
  });

  const targetMessage = await prisma.message.findFirst({
    where: {
      id: messageId,
      groupId,
      chatId: group.chatId,
    },
    include: messageInclude,
  });

  if (!targetMessage) throw new AppError(404, "Message not found");

  const ordered = [...before.reverse(), targetMessage, ...after];
  const summaryMap = await buildReactionSummaryMap(
    ordered.map((item) => item.id),
    userId
  );
  const chatDek = await getChatDek(group.chatId);
  const dek = chatDek?.dek ?? null;

  return {
    targetMessageId: messageId,
    items: ordered.map((item) =>
      withGroupMessageMeta(item, dek, {
        reactionSummary: summaryMap.get(item.id) ?? [],
      })
    ),
  };
};

const markGroupMessagesRead = async (groupId: string, userId: string, messageIds: string[]) => {
  await requireGroupRole(groupId, userId);
  const group = await ensureGroupWithChat(groupId);
  const ids = Array.from(new Set(messageIds.filter(Boolean)));
  if (ids.length === 0) {
    await prisma.chatParticipant.update({
      where: { userId_chatId: { userId, chatId: group.chatId } },
      data: { lastReadAt: new Date() },
    });
    return [];
  }

  const eligibleMessages = await prisma.message.findMany({
    where: {
      id: { in: ids },
      chatId: group.chatId,
      groupId,
      kind: MessageKind.USER,
      senderId: { not: userId },
    },
    select: { id: true },
  });

  if (eligibleMessages.length === 0) {
    await prisma.chatParticipant.update({
      where: { userId_chatId: { userId, chatId: group.chatId } },
      data: { lastReadAt: new Date() },
    });
    return [];
  }

  const eligibleIds = eligibleMessages.map((item) => item.id);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.messageRead.createMany({
      data: eligibleIds.map((messageId) => ({
        messageId,
        userId,
        readAt: now,
      })),
      skipDuplicates: true,
    });

    await tx.chatParticipant.update({
      where: { userId_chatId: { userId, chatId: group.chatId } },
      data: { lastReadAt: now },
    });
  });

  const readCounts = await prisma.messageRead.groupBy({
    by: ["messageId"],
    where: {
      messageId: { in: eligibleIds },
      OR: [
        {
          user: {
            is: {
              settings: {
                is: null,
              },
            },
          },
        },
        {
          user: {
            is: {
              settings: {
                is: {
                  readReceiptsEnabled: true,
                },
              },
            },
          },
        },
      ],
    },
    _count: { messageId: true },
  });
  const countMap = new Map<string, number>(
    readCounts.map((item) => [
      item.messageId,
      Number(((item._count as { messageId?: number })?.messageId ?? 0)),
    ])
  );

  return eligibleIds.map((messageId) => ({
    messageId,
    userId,
    readAt: now,
    readCount: countMap.get(messageId) ?? 0,
  }));
};

const getMessageReads = async (messageId: string, requesterUserId: string) => {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      groupId: true,
      kind: true,
      senderId: true,
    },
  });
  if (!message) throw new AppError(404, "Message not found");
  if (!message.groupId) throw new AppError(400, "Seen-by is only available for group messages");

  await requireGroupRole(message.groupId, requesterUserId);
  if (message.kind === MessageKind.SYSTEM) return [];

  const reads = await prisma.messageRead.findMany({
    where: {
      messageId: message.id,
      OR: [
        {
          user: {
            is: {
              settings: {
                is: null,
              },
            },
          },
        },
        {
          user: {
            is: {
              settings: {
                is: {
                  readReceiptsEnabled: true,
                },
              },
            },
          },
        },
      ],
    },
    orderBy: { readAt: "asc" },
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

  return reads
    .filter((read) => read.userId !== message.senderId)
    .map((read) => ({
      userId: read.user.id,
      username: read.user.username,
      avatar: read.user.avatar,
      readAt: read.readAt,
    }));
};

const deleteGroup = async (groupId: string, userId: string) => {
  await requireCreator(groupId, userId);
  const group = await ensureGroupWithChat(groupId);
  await prisma.chat.delete({ where: { id: group.chatId } });
  return { ok: true };
};

export const groupService = {
  requireGroupRole,
  requireAtLeastAdmin,
  requireCreator,
  createGroup,
  getMyGroups,
  getGroupDetails,
  updateGroup,
  updateRules,
  addMembers,
  removeMember,
  leaveGroup,
  transferCreator,
  setAdminRole,
  issueInvite,
  revokeInvite,
  joinByInviteToken,
  getGroupMessages,
  getGroupMessagesAround,
  createGroupMessage,
  markGroupMessagesRead,
  getMessageReads,
  deleteGroup,
};
