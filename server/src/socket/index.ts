import { MessageStatus, type MessageType, type SystemEvent } from "@prisma/client";
import { getIO } from "./socket.server";

export * from "./socket.server";
export * from "./types";

export const chatRoom = (chatId: string) => `chat:${chatId}`;
export const userRoom = (userId: string) => `user:${userId}`;

type RealtimeMessageInput = {
  id: string;
  chatId: string;
  groupId?: string | null;
  senderId: string | null;
  sender: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
  } | null;
  systemActor?: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
  } | null;
  content: string | null;
  decryptError?: boolean;
  text?: string | null;
  mediaUrl: string | null;
  type: MessageType;
  kind: "USER" | "SYSTEM";
  systemEvent: SystemEvent | null;
  deletedForEveryone: boolean;
  deletedAt: Date | null;
  deletedById: string | null;
  replyToId: string | null;
  replyTo?: {
    id: string;
    type: MessageType;
    content: string | null;
    mediaUrl: string | null;
    deletedForEveryone: boolean;
    senderId: string | null;
    createdAt: Date;
    sender: {
      id: string;
      name: string | null;
      username: string;
    } | null;
    decryptError?: boolean;
  } | null;
  replyToPreview?: {
    id: string;
    senderId: string | null;
    senderUsername: string;
    textSnippet: string;
    mediaType?: MessageType;
    isDeletedForEveryone?: boolean;
    kind: "USER" | "SYSTEM";
  } | null;
  isForwarded: boolean;
  forwardFromMessageId: string | null;
  forwardFromSenderId: string | null;
  createdAt: Date;
  status: MessageStatus;
  readCount?: number;
  deliveredToAtLeastOne?: boolean;
  reactionSummary?: Array<{
    emoji: string;
    count: number;
    reactedByMe: boolean;
  }>;
};

const mapMessage = (message: RealtimeMessageInput) => ({
  id: message.id,
  chatId: message.chatId,
  groupId: message.groupId ?? null,
  senderId: message.senderId,
  sender: message.sender,
  content: message.content ?? message.text ?? null,
  decryptError: message.decryptError ?? false,
  mediaUrl: message.mediaUrl,
  type: message.type,
  kind: message.kind,
  systemEvent: message.systemEvent,
  systemActor: message.systemActor ?? null,
  deletedForEveryone: message.deletedForEveryone,
  deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
  deletedById: message.deletedById,
  replyToId: message.replyToId,
  replyTo: message.replyTo
    ? {
        id: message.replyTo.id,
        type: message.replyTo.type,
        content: message.replyTo.content,
        mediaUrl: message.replyTo.mediaUrl,
        deletedForEveryone: message.replyTo.deletedForEveryone,
        senderId: message.replyTo.senderId,
        createdAt: message.replyTo.createdAt.toISOString(),
        sender: message.replyTo.sender,
        decryptError: message.replyTo.decryptError ?? false,
      }
    : null,
  replyToPreview:
    message.replyToPreview ??
    (message.replyTo
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
            ? message.replyTo.content ?? "Document"
            : message.replyTo.content ?? "",
          mediaType: message.replyTo.type,
          isDeletedForEveryone: message.replyTo.deletedForEveryone,
          kind: "USER",
        }
      : null),
  isForwarded: message.isForwarded,
  forwardFromMessageId: message.forwardFromMessageId,
  forwardFromSenderId: message.forwardFromSenderId,
  createdAt: message.createdAt.toISOString(),
  status: message.status,
  readCount: message.readCount ?? 0,
  deliveredToAtLeastOne: message.deliveredToAtLeastOne ?? false,
  reactionSummary: message.reactionSummary ?? [],
});

export const emitNewMessage = (message: RealtimeMessageInput) => {
  const io = getIO();
  if (!io) return;
  io.to(chatRoom(message.chatId)).emit("new_message", mapMessage(message));
};

export const emitGroupMessageNew = (message: RealtimeMessageInput) => {
  const io = getIO();
  if (!io) return;
  io.to(chatRoom(message.chatId)).emit("group:message_new", mapMessage(message));
};

export const emitGroupUpdated = (chatId: string, payload: {
  groupId: string;
  title: string;
  avatar: string | null;
  description: string | null;
  rulesText: string | null;
  memberCount: number;
  updatedAt: string;
}) => {
  const io = getIO();
  if (!io) return;
  io.to(chatRoom(chatId)).emit("group:updated", payload);
};

export const emitGroupMembersUpdated = (
  chatId: string,
  payload: {
    groupId: string;
    memberCount: number;
    action: "ADD" | "REMOVE" | "PROMOTE" | "DEMOTE" | "LEAVE" | "JOIN";
    userIds?: string[];
    updatedAt: string;
  }
) => {
  const io = getIO();
  if (!io) return;
  io.to(chatRoom(chatId)).emit("group:members_updated", payload);
};

export const emitGroupMemberLeft = (
  chatId: string,
  payload: {
    groupId: string;
    userId: string;
    at: string;
  }
) => {
  const io = getIO();
  if (!io) return;
  io.to(chatRoom(chatId)).emit("group:member_left", payload);
};

export const emitGroupRoleUpdated = (
  chatId: string,
  payload: {
    groupId: string;
    userId: string;
    role: "CREATOR" | "ADMIN" | "MEMBER";
    previousRole?: "CREATOR" | "ADMIN" | "MEMBER";
    at: string;
    isCreatorTransfer?: boolean;
  }
) => {
  const io = getIO();
  if (!io) return;
  io.to(chatRoom(chatId)).emit("group:role_updated", payload);
};

export const emitGroupInviteUpdated = (
  chatId: string,
  payload: {
    groupId: string;
    token: string | null;
    revokedAt: string | null;
    expiresAt: string | null;
    updatedAt: string;
  }
) => {
  const io = getIO();
  if (!io) return;
  io.to(chatRoom(chatId)).emit("group:invite_updated", payload);
};

export const emitMessageStatusUpdate = (payload: {
  chatId: string;
  messageId: string;
  status: MessageStatus;
}) => {
  const io = getIO();
  if (!io) return;

  io.to(chatRoom(payload.chatId)).emit("message_status_update", {
    chatId: payload.chatId,
    messageId: payload.messageId,
    status: payload.status,
  });
};

export const emitMessageRead = (payload: { chatId: string; readerId: string }) => {
  const io = getIO();
  if (!io) return;

  io.to(chatRoom(payload.chatId)).emit("message_read", payload);
};

export const emitGroupMessageDelivered = (payload: {
  senderId: string;
  messageId: string;
  deliveredToAtLeastOne: boolean;
}) => {
  const io = getIO();
  if (!io) return;

  io.to(userRoom(payload.senderId)).emit("group:message_delivered", {
    messageId: payload.messageId,
    deliveredToAtLeastOne: payload.deliveredToAtLeastOne,
  });
};

export const emitGroupMessageRead = (payload: {
  chatId: string;
  groupId: string;
  messageId: string;
  userId: string;
  readAt: string;
  readCount: number;
}) => {
  const io = getIO();
  if (!io) return;

  io.to(chatRoom(payload.chatId)).emit("group:message_read", payload);
};

export const emitMessageDeleted = (payload: {
  chatId: string;
  messageIds: string[];
  deletedById: string;
  deletedAt: string;
}) => {
  const io = getIO();
  if (!io) return;

  io.to(chatRoom(payload.chatId)).emit("message_deleted", payload);
};

export const emitMessageReactionUpdated = (payload: {
  messageId: string;
  chatType: "DM" | "GROUP" | "AI";
  chatId: string;
  groupId?: string | null;
  summary: Array<{ emoji: string; count: number }>;
  actorUserId: string;
  emoji: string;
  action: "ADDED" | "REMOVED";
}) => {
  const io = getIO();
  if (!io) return;

  io.to(chatRoom(payload.chatId)).emit("message_reaction_updated", payload);
};

export const emitUnreadUpdateToUser = (
  userId: string,
  payload: {
    chatId: string;
    unreadCount: number;
    totalUnread: number;
    directUnread: number;
    groupUnread: number;
    aiUnread: number;
    unreadCountDelta: number;
    totalUnreadDelta: number;
  }
) => {
  const io = getIO();
  if (!io) return;

  io.to(userRoom(userId)).emit("unread_update", payload);
};

export const emitUnreadResetToUser = (
  userId: string,
  payload: { chatId: string; unreadCount: number }
) => {
  const io = getIO();
  if (!io) return;

  io.to(userRoom(userId)).emit("unread_reset", payload);
};

export const emitAiTurnCreatedToUser = (
  userId: string,
  payload: {
    threadId: string;
    turn: {
      id: string;
      threadId: string;
      role: "USER" | "AI";
      content: string;
      meta?: Record<string, unknown> | null;
      createdAt: string;
    };
  }
) => {
  const io = getIO();
  if (!io) return;
  io.to(userRoom(userId)).emit("ai_turn_created", payload);
};

export const emitAiTurnUpdatedToUser = (
  userId: string,
  payload: {
    threadId: string;
    turn: {
      id: string;
      threadId: string;
      role: "USER" | "AI";
      content: string;
      meta?: Record<string, unknown> | null;
      createdAt: string;
    };
  }
) => {
  const io = getIO();
  if (!io) return;
  io.to(userRoom(userId)).emit("ai_turn_updated", payload);
};

export const emitAiThreadUpdatedToUser = (
  userId: string,
  payload: {
    threadId: string;
    updatedAt: string;
  }
) => {
  const io = getIO();
  if (!io) return;
  io.to(userRoom(userId)).emit("ai_thread_updated", payload);
};

export const removeUserFromChatRoom = (chatId: string, userId: string) => {
  const io = getIO();
  if (!io) return;
  const room = io.sockets.adapter.rooms.get(chatRoom(chatId));
  if (!room) return;
  room.forEach((socketId) => {
    const sock = io.sockets.sockets.get(socketId);
    if (!sock) return;
    if (sock.data?.user?.id === userId) {
      sock.leave(chatRoom(chatId));
    }
  });
};
