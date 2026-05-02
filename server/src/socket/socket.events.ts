import { MessageStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { chatService } from "../modules/chat/chat.service";
import { privacyGuard } from "../modules/privacy/privacy.guard";
import { registerCallSocketEvents } from "../modules/calls/call.socket";
import { callService } from "../modules/calls/call.service";
import {
  addUserSocket,
  getOnlineUserIds,
  isUserOnline,
  removeUserSocket,
} from "./presence.store";
import type {
  AuthenticatedSocket,
  ClientToServerEvents,
  IOServer,
  TypingPayload,
  DeliveredPayload,
  MarkReadPayload,
  JoinChatPayload,
} from "./types";

const toSafeErrorMeta = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }
  return { message: "Unknown socket error" };
};

const RATE_LIMIT_WINDOW_MS = 5000;
const RATE_LIMIT_MAX_EVENTS = 40;
const rateState = new Map<string, { count: number; windowStart: number }>();

const chatRoom = (chatId: string) => `chat:${chatId}`;
const userRoom = (userId: string) => `user:${userId}`;

const isRateLimited = (socket: AuthenticatedSocket, event: keyof ClientToServerEvents) => {
  const now = Date.now();
  const key = `${socket.id}:${event}`;
  const current = rateState.get(key);

  if (!current || now - current.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateState.set(key, { count: 1, windowStart: now });
    return false;
  }

  current.count += 1;
  rateState.set(key, current);
  return current.count > RATE_LIMIT_MAX_EVENTS;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const ensureParticipant = async (userId: string, chatId: string) => {
  await chatService.assertParticipant(userId, chatId);
};

const registerTypingEvents = (socket: AuthenticatedSocket) => {
  const userId = socket.data.user.id;

  socket.on("typing", async (payload: TypingPayload) => {
    try {
      if (isRateLimited(socket, "typing")) return;
      if (!isNonEmptyString(payload?.chatId)) return;

      const chatId = payload.chatId;
      await ensureParticipant(userId, chatId);
      socket.to(chatRoom(chatId)).emit("typing", { chatId, userId });
    } catch {
      socket.emit("socket_error", { code: "FORBIDDEN", message: "Invalid typing payload" });
    }
  });

  socket.on("stop_typing", async (payload: TypingPayload) => {
    try {
      if (isRateLimited(socket, "stop_typing")) return;
      if (!isNonEmptyString(payload?.chatId)) return;

      const chatId = payload.chatId;
      await ensureParticipant(userId, chatId);
      socket.to(chatRoom(chatId)).emit("stop_typing", { chatId, userId });
    } catch {
      socket.emit("socket_error", {
        code: "FORBIDDEN",
        message: "Invalid stop_typing payload",
      });
    }
  });
};

const registerJoinChatEvent = (socket: AuthenticatedSocket) => {
  const userId = socket.data.user.id;

  socket.on("join_chat", async (payload: JoinChatPayload) => {
    try {
      if (isRateLimited(socket, "join_chat")) return;
      if (!isNonEmptyString(payload?.chatId)) return;

      const chatId = payload.chatId;
      await ensureParticipant(userId, chatId);
      socket.join(chatRoom(chatId));
    } catch {
      socket.emit("socket_error", { code: "FORBIDDEN", message: "Invalid join_chat payload" });
    }
  });
};

const registerDeliveredEvent = (io: IOServer, socket: AuthenticatedSocket) => {
  const userId = socket.data.user.id;

  socket.on("message_delivered", async (payload: DeliveredPayload) => {
    try {
      if (isRateLimited(socket, "message_delivered")) return;
      if (!isNonEmptyString(payload?.chatId) || !isNonEmptyString(payload?.messageId)) {
        return;
      }

      const { chatId, messageId } = payload;
      await ensureParticipant(userId, chatId);

      const result = await prisma.message.updateMany({
        where: {
          id: messageId,
          chatId,
          senderId: { not: userId },
          status: MessageStatus.SENT,
        },
        data: { status: MessageStatus.DELIVERED },
      });

      if (result.count > 0) {
        io.to(chatRoom(chatId)).emit("message_status_update", {
          chatId,
          messageId,
          status: MessageStatus.DELIVERED,
        });
      }
    } catch {
      socket.emit("socket_error", {
        code: "FORBIDDEN",
        message: "Invalid message_delivered payload",
      });
    }
  });
};

const registerMarkReadEvent = (io: IOServer, socket: AuthenticatedSocket) => {
  const userId = socket.data.user.id;

  socket.on("mark_read", async (payload: MarkReadPayload) => {
    try {
      if (isRateLimited(socket, "mark_read")) return;
      if (!isNonEmptyString(payload?.chatId)) return;

      const chatId = payload.chatId;
      await ensureParticipant(userId, chatId);

      await prisma.message.updateMany({
        where: {
          chatId,
          senderId: { not: userId },
          status: { not: MessageStatus.READ },
        },
        data: { status: MessageStatus.READ },
      });

      await prisma.chatParticipant.update({
        where: { userId_chatId: { userId, chatId } },
        data: { lastReadAt: new Date() },
      });

      const canBroadcastRead = await privacyGuard.shouldBroadcastReadReceipts(userId);
      if (canBroadcastRead) {
        io.to(chatRoom(chatId)).emit("message_read", { chatId, readerId: userId });
      }
      socket.emit("unread_reset", { chatId, unreadCount: 0 });
    } catch {
      socket.emit("socket_error", { code: "FORBIDDEN", message: "Invalid mark_read payload" });
    }
  });
};

const joinUserChatRooms = async (socket: AuthenticatedSocket) => {
  const userId = socket.data.user.id;
  socket.join(userRoom(userId));

  const chats = await prisma.chatParticipant.findMany({
    where: { userId },
    select: { chatId: true },
  });

  chats.forEach(({ chatId }) => {
    socket.join(chatRoom(chatId));
  });
};

export const registerSocketEvents = (io: IOServer) => {
  io.on("connection", async (socket) => {
    const { id: userId } = socket.data.user;

    try {
      const wasOnline = isUserOnline(userId);
      addUserSocket(userId, socket.id);

      await joinUserChatRooms(socket);
      socket.emit("online_users", { userIds: getOnlineUserIds() });

      if (!wasOnline) {
        socket.broadcast.emit("user_online", { userId });
      }

      registerTypingEvents(socket);
      registerJoinChatEvent(socket);
      registerDeliveredEvent(io, socket);
      registerMarkReadEvent(io, socket);
      registerCallSocketEvents(io, socket);
      callService.onSocketConnect(userId);

      socket.on("disconnect", () => {
        void callService.onSocketDisconnect(userId);
        const remaining = removeUserSocket(userId, socket.id);
        rateState.forEach((_value, key) => {
          if (key.startsWith(`${socket.id}:`)) {
            rateState.delete(key);
          }
        });

        if (remaining === 0) {
          socket.broadcast.emit("user_offline", { userId });
        }
      });

      socket.on("error", (error) => {
        console.error("Socket error", {
          userId,
          socketId: socket.id,
          error: toSafeErrorMeta(error),
        });
      });
    } catch (error) {
      console.error("Socket connection bootstrap failed", {
        userId,
        socketId: socket.id,
        error: toSafeErrorMeta(error),
      });
      socket.disconnect(true);
    }
  });
};
