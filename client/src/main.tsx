import ReactDOM from "react-dom/client";
import { StrictMode, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import { fetchUnreadSummary } from "./api/chat.api";
import { connectSocket } from "./lib/socket";
import { registerCallSocketHandlers } from "./features/calls/socket";
import { useAuthStore } from "./stores/authStore";
import { useChatStore } from "./stores/chatStore";
import { useAiThreadStore } from "./stores/aiThreadStore";
import "./index.css";
import "../src/styles/scrollbar.css";

function SessionBootstrap() {
  const hydrateFromStorage = useAuthStore((state) => state.hydrateFromStorage);
  const bootstrapMe = useAuthStore((state) => state.bootstrapMe);
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id);
  const appendMessage = useChatStore((state) => state.appendMessage);
  const setMessages = useChatStore((state) => state.setMessages);
  const setUnreadSummary = useChatStore((state) => state.setUnreadSummary);
  const incrementUnreadForChat = useChatStore((state) => state.incrementUnreadForChat);
  const resetUnreadForChat = useChatStore((state) => state.resetUnreadForChat);
  const applyUnreadUpdate = useChatStore((state) => state.applyUnreadUpdate);
  const updateMessageStatus = useChatStore((state) => state.updateMessageStatus);
  const markMessagesReadByReader = useChatStore((state) => state.markMessagesReadByReader);
  const markMessagesDeletedForEveryone = useChatStore(
    (state) => state.markMessagesDeletedForEveryone
  );
  const setTypingUser = useChatStore((state) => state.setTypingUser);
  const stopTypingUser = useChatStore((state) => state.stopTypingUser);
  const setOnlineUsers = useChatStore((state) => state.setOnlineUsers);
  const setUserOnline = useChatStore((state) => state.setUserOnline);
  const setUserOffline = useChatStore((state) => state.setUserOffline);
  const applyGroupPatch = useChatStore((state) => state.applyGroupPatch);
  const applyAiTurnCreated = useAiThreadStore((state) => state.applyTurnCreated);
  const applyAiTurnUpdated = useAiThreadStore((state) => state.applyTurnUpdated);

  useEffect(() => {
    hydrateFromStorage();
    void bootstrapMe();
  }, [bootstrapMe, hydrateFromStorage]);

  useEffect(() => {
    if (!token) return;

    void fetchUnreadSummary()
      .then((summary) => {
        setUnreadSummary(summary);
      })
      .catch((error) => {
        console.error("Failed to fetch unread summary", error);
      });
  }, [setUnreadSummary, token]);

  useEffect(() => {
    if (!token) return;

    const socket = connectSocket();
    if (!socket) return;
    const unregisterCallSocket = registerCallSocketHandlers(socket);

    const isVisibleAndFocused = () =>
      document.visibilityState === "visible" && document.hasFocus();
    const isChatOpen = (chatId: string) => {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const section = parts[0];
      const routeId = parts[1];
      if (!routeId) return false;
      if (section === "chat") {
        return decodeURIComponent(routeId) === chatId;
      }
      if (section === "groups") {
        const activeGroupId = decodeURIComponent(routeId);
        const groupChat = useChatStore
          .getState()
          .chats.find((chat) => chat.type === "GROUP" && chat.group?.id === activeGroupId);
        return groupChat?.id === chatId;
      }
      return false;
    };

    const handleNewMessage = (payload: {
      id: string;
      chatId: string;
      senderId: string | null;
      sender: {
        id: string;
        username: string;
        name: string | null;
        avatar: string | null;
      } | null;
      systemActor: {
        id: string;
        username: string;
        name: string | null;
        avatar: string | null;
      } | null;
      kind: "USER" | "SYSTEM";
      systemEvent:
        | "MEMBER_JOIN"
        | "MEMBER_LEAVE"
        | "MEMBER_ADDED"
        | "MEMBER_REMOVED"
        | "ADMIN_PROMOTED"
        | "ADMIN_DEMOTED"
        | "GROUP_UPDATED"
        | "RULES_UPDATED"
        | null;
      content: string | null;
      mediaUrl: string | null;
      type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
      deletedForEveryone: boolean;
      deletedAt: string | null;
      deletedById: string | null;
      replyToId: string | null;
      replyTo: {
        id: string;
        type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
        content: string | null;
        mediaUrl: string | null;
        deletedForEveryone: boolean;
        senderId: string;
        createdAt: string;
        sender: {
          id: string;
          name: string;
          username: string;
        };
      } | null;
      isForwarded: boolean;
      forwardFromMessageId: string | null;
      forwardFromSenderId: string | null;
      createdAt: string;
      status: "SENT" | "DELIVERED" | "READ";
      reactionSummary?: Array<{
        emoji: string;
        count: number;
        reactedByMe: boolean;
      }>;
    }) => {
      appendMessage(payload);
      if (payload.senderId) {
        stopTypingUser(payload.chatId, payload.senderId);
      }

      if (payload.senderId && payload.senderId !== userId) {
        const shouldIncreaseUnread = !(isChatOpen(payload.chatId) && isVisibleAndFocused());
        if (shouldIncreaseUnread) {
          incrementUnreadForChat(payload.chatId, 1);
        } else {
          resetUnreadForChat(payload.chatId);
        }

        socket.emit("message_delivered", {
          chatId: payload.chatId,
          messageId: payload.id,
        });
      }
    };

    const handleGroupUpdated = (payload: {
      groupId: string;
      title: string;
      avatar: string | null;
      description: string | null;
      rulesText: string | null;
      memberCount: number;
      updatedAt: string;
    }) => {
      applyGroupPatch(payload.groupId, {
        title: payload.title,
        avatar: payload.avatar,
        description: payload.description,
        rulesText: payload.rulesText,
        memberCount: payload.memberCount,
      });
    };

    const handleGroupMembersUpdated = (payload: {
      groupId: string;
      memberCount: number;
      action: "ADD" | "REMOVE" | "PROMOTE" | "DEMOTE" | "LEAVE" | "JOIN";
      userIds?: string[];
      updatedAt: string;
    }) => {
      void payload.action;
      void payload.userIds;
      void payload.updatedAt;
      applyGroupPatch(payload.groupId, {
        memberCount: payload.memberCount,
      });
    };

    const handleMessageStatusUpdate = (payload: {
      chatId: string;
      messageId: string;
      status: "SENT" | "DELIVERED" | "READ";
    }) => {
      updateMessageStatus(payload.chatId, payload.messageId, payload.status);
    };

    const handleMessageRead = (payload: { chatId: string; readerId: string }) => {
      markMessagesReadByReader(payload.chatId, payload.readerId);
    };

    const handleMessageDeleted = (payload: {
      chatId: string;
      messageIds: string[];
      deletedById: string;
      deletedAt: string;
    }) => {
      markMessagesDeletedForEveryone(payload.chatId, payload.messageIds, {
        deletedById: payload.deletedById,
        deletedAt: payload.deletedAt,
      });
    };

    const handleMessageReactionUpdated = (payload: {
      messageId: string;
      chatType: "DM" | "GROUP" | "AI";
      chatId: string;
      groupId?: string | null;
      summary: Array<{ emoji: string; count: number }>;
      actorUserId: string;
      emoji: string;
      action: "ADDED" | "REMOVED";
    }) => {
      if (payload.actorUserId === userId) return;
      const existing = useChatStore.getState().messagesByChatId[payload.chatId] ?? [];
      if (existing.length === 0) return;

      const next = existing.map((message) => {
        if (message.id !== payload.messageId) return message;
        const prior = message.reactionSummary ?? [];
        const merged = payload.summary.map((item) => ({
          emoji: item.emoji,
          count: item.count,
          reactedByMe:
            prior.find((existingItem) => existingItem.emoji === item.emoji)
              ?.reactedByMe ?? false,
        }));
        return { ...message, reactionSummary: merged };
      });

      setMessages(payload.chatId, next);
    };

    const handleUnreadUpdate = (payload: {
      chatId: string;
      unreadCount: number;
      totalUnread: number;
      directUnread: number;
      groupUnread: number;
      aiUnread: number;
      unreadCountDelta: number;
      totalUnreadDelta: number;
    }) => {
      applyUnreadUpdate({
        chatId: payload.chatId,
        unreadCount: payload.unreadCount,
        totalUnread: payload.totalUnread,
        directUnread: payload.directUnread,
        groupUnread: payload.groupUnread,
        aiUnread: payload.aiUnread,
      });
    };

    const handleUnreadReset = (payload: { chatId: string; unreadCount: number }) => {
      resetUnreadForChat(payload.chatId);
    };

    const handleTyping = (payload: { chatId: string; userId: string }) => {
      if (payload.userId === userId) return;
      setTypingUser(payload.chatId, payload.userId);
    };

    const handleStopTyping = (payload: { chatId: string; userId: string }) => {
      if (payload.userId === userId) return;
      stopTypingUser(payload.chatId, payload.userId);
    };

    const handleOnlineUsers = (payload: { userIds: string[] }) => {
      setOnlineUsers(payload.userIds);
    };

    const handleUserOnline = (payload: { userId: string }) => {
      setUserOnline(payload.userId);
    };

    const handleUserOffline = (payload: { userId: string }) => {
      setUserOffline(payload.userId);
    };

    const handleAiTurnCreated = (payload: {
      threadId: string;
      turn: {
        id: string;
        threadId: string;
        role: "USER" | "AI";
        content: string;
        meta?: Record<string, unknown> | null;
        createdAt: string;
      };
    }) => {
      applyAiTurnCreated(payload.threadId, payload.turn);
    };

    const handleAiTurnUpdated = (payload: {
      threadId: string;
      turn: {
        id: string;
        threadId: string;
        role: "USER" | "AI";
        content: string;
        meta?: Record<string, unknown> | null;
        createdAt: string;
      };
    }) => {
      applyAiTurnUpdated(payload.threadId, payload.turn);
    };

    socket.on("online_users", handleOnlineUsers);
    socket.on("user_online", handleUserOnline);
    socket.on("user_offline", handleUserOffline);
    socket.on("new_message", handleNewMessage);
    socket.on("group:message_new", handleNewMessage);
    socket.on("group:updated", handleGroupUpdated);
    socket.on("group:members_updated", handleGroupMembersUpdated);
    socket.on("message_status_update", handleMessageStatusUpdate);
    socket.on("message_read", handleMessageRead);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("message_reaction_updated", handleMessageReactionUpdated);
    socket.on("unread_update", handleUnreadUpdate);
    socket.on("unread_reset", handleUnreadReset);
    socket.on("typing", handleTyping);
    socket.on("stop_typing", handleStopTyping);
    socket.on("ai_turn_created", handleAiTurnCreated);
    socket.on("ai_turn_updated", handleAiTurnUpdated);

    return () => {
      unregisterCallSocket();
      socket.off("online_users", handleOnlineUsers);
      socket.off("user_online", handleUserOnline);
      socket.off("user_offline", handleUserOffline);
      socket.off("new_message", handleNewMessage);
      socket.off("group:message_new", handleNewMessage);
      socket.off("group:updated", handleGroupUpdated);
      socket.off("group:members_updated", handleGroupMembersUpdated);
      socket.off("message_status_update", handleMessageStatusUpdate);
      socket.off("message_read", handleMessageRead);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("message_reaction_updated", handleMessageReactionUpdated);
      socket.off("unread_update", handleUnreadUpdate);
      socket.off("unread_reset", handleUnreadReset);
      socket.off("typing", handleTyping);
      socket.off("stop_typing", handleStopTyping);
      socket.off("ai_turn_created", handleAiTurnCreated);
      socket.off("ai_turn_updated", handleAiTurnUpdated);
    };
  }, [
    appendMessage,
    applyUnreadUpdate,
    incrementUnreadForChat,
    markMessagesDeletedForEveryone,
    markMessagesReadByReader,
    resetUnreadForChat,
    setMessages,
    setOnlineUsers,
    setTypingUser,
    setUserOffline,
    setUserOnline,
    stopTypingUser,
    token,
    updateMessageStatus,
    applyGroupPatch,
    applyAiTurnCreated,
    applyAiTurnUpdated,
    userId,
  ]);

  return null;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionBootstrap />
      <App />
    </BrowserRouter>
  </StrictMode>
);
