import { create } from "zustand";
import { getNearbyUsers } from "../api/user.api";
import type { ChatRecord, MessageRecord, NearbyUserRecord } from "../api/types";
import { withDevtools } from "./storeUtils";

export type ChatListItem = {
  chatId: string;
  groupId?: string;
  title: string;
  username: string;
  avatar?: string;
  lastMessage?: string;
  rawLastMessage?: string;
  myRole?: "CREATOR" | "ADMIN" | "MEMBER";
  memberCount?: number;
  description?: string | null;
  rulesText?: string | null;
  lastMessageAt: string;
  peerUserId?: string;
  isPinned: boolean;
  pinnedAt?: string;
  isArchived: boolean;
  archivedAt?: string;
  customOrder?: number;
  unreadCount?: number;
  type: "DIRECT" | "GROUP" | "AI";
};

export type UiMessage = {
  id: string;
  sender: "me" | "them";
  senderId: string | null;
  kind?: "USER" | "SYSTEM";
  systemEvent?:
    | "MEMBER_JOIN"
    | "MEMBER_LEAVE"
    | "MEMBER_ADDED"
    | "MEMBER_REMOVED"
    | "ADMIN_PROMOTED"
    | "ADMIN_DEMOTED"
    | "GROUP_UPDATED"
    | "RULES_UPDATED"
    | null;
  systemActor?: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
  } | null;
  content: string;
  text: string;
  decryptError?: boolean;
  mediaUrl?: string;
  messageType?: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  deletedForEveryone?: boolean;
  deletedAt?: string | null;
  deletedById?: string | null;
  replyToId?: string;
  replyTo?: {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    decryptError?: boolean;
    mediaUrl?: string;
    messageType: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
    deletedForEveryone?: boolean;
  } | null;
  isForwarded?: boolean;
  createdAt: string;
  time: string;
  status?: "sent" | "delivered" | "read";
  isUploading?: boolean;
  uploadProgress?: number;
  reactionSummary?: Array<{
    emoji: string;
    count: number;
    reactedByMe: boolean;
  }>;
};

export type UnreadSummary = {
  total: number;
  direct: number;
  group: number;
  ai: number;
};

type ChatStore = {
  chats: ChatRecord[];
  totalUnread: number;
  unreadSummary: UnreadSummary;
  nearbyUsers: NearbyUserRecord[];
  messagesByChatId: Record<string, MessageRecord[]>;
  typingUsersByChatId: Record<string, string[]>;
  onlineUsers: Set<string>;
  isMultiSelect: boolean;
  selectedMessageIds: Record<string, true>;
  selectionAnchorId: string | null;
  selectionVersion: number;
  setTotalUnread: (totalUnread: number) => void;
  setUnreadSummary: (summary: UnreadSummary) => void;
  setChats: (chats: ChatRecord[]) => void;
  upsertChat: (chat: ChatRecord) => void;
  incrementUnreadForChat: (chatId: string, delta?: number) => void;
  resetUnreadForChat: (chatId: string) => void;
  applyUnreadUpdate: (payload: {
    chatId: string;
    unreadCount: number;
    totalUnread: number;
    directUnread: number;
    groupUnread: number;
    aiUnread: number;
  }) => void;
  setNearbyUsers: (users: NearbyUserRecord[]) => void;
  loadNearbyUsers: () => Promise<void>;
  removeNearbyUser: (userId: string) => void;
  setMessages: (chatId: string, messages: MessageRecord[]) => void;
  appendMessage: (message: MessageRecord) => void;
  updateMessageStatus: (
    chatId: string,
    messageId: string,
    status: MessageRecord["status"]
  ) => void;
  markMessagesReadByReader: (chatId: string, readerId: string) => void;
  removeMessage: (chatId: string, messageId: string) => void;
  removeMessages: (chatId: string, messageIds: string[]) => void;
  enterMultiSelect: (initialId?: string) => void;
  toggleMessageSelected: (id: string) => void;
  exitMultiSelect: () => void;
  clearSelection: () => void;
  resetMultiSelect: () => void;
  markMessagesDeletedForEveryone: (
    chatId: string,
    messageIds: string[],
    meta?: { deletedById?: string; deletedAt?: string }
  ) => void;
  setTypingUser: (chatId: string, userId: string) => void;
  stopTypingUser: (chatId: string, userId: string) => void;
  clearTypingUsersForChat: (chatId: string) => void;
  setOnlineUsers: (userIds: string[]) => void;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  applyParticipantState: (
    chatId: string,
    patch: Partial<{
      pinned: boolean;
      pinnedAt: string | null;
      archived: boolean;
      archivedAt: string | null;
      customOrder: number | null;
    }>
  ) => void;
  applyGroupPatch: (
    groupId: string,
    patch: Partial<{
      title: string;
      avatar: string | null;
      description: string | null;
      rulesText: string | null;
      memberCount: number;
    }>
  ) => void;
  applyChatCustomOrder: (orders: Array<{ chatId: string; order: number }>) => void;
  reset: () => void;
};

const toTimestamp = (value?: string | null) => (value ? new Date(value).getTime() : 0);

const sortChats = (chats: ChatRecord[]) =>
  [...chats].sort((a, b) => {
    const aParticipant = a.viewerParticipant;
    const bParticipant = b.viewerParticipant;

    const aArchived = Boolean(aParticipant?.archived);
    const bArchived = Boolean(bParticipant?.archived);
    if (aArchived !== bArchived) return aArchived ? 1 : -1;

    const aPinned = Boolean(aParticipant?.pinned);
    const bPinned = Boolean(bParticipant?.pinned);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;

    if (aPinned && bPinned) {
      return toTimestamp(bParticipant?.pinnedAt) - toTimestamp(aParticipant?.pinnedAt);
    }

    const aCustomOrder = aParticipant?.customOrder;
    const bCustomOrder = bParticipant?.customOrder;
    const aHasOrder = typeof aCustomOrder === "number";
    const bHasOrder = typeof bCustomOrder === "number";

    if (aHasOrder && bHasOrder) return (aCustomOrder ?? 0) - (bCustomOrder ?? 0);
    if (aHasOrder !== bHasOrder) return aHasOrder ? -1 : 1;

    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

const toLowerMessageStatus = (
  status: MessageRecord["status"]
): UiMessage["status"] => {
  if (status === "READ") return "read";
  if (status === "DELIVERED") return "delivered";
  return "sent";
};

const clampUnreadSummary = (summary: UnreadSummary): UnreadSummary => ({
  total: Math.max(0, summary.total),
  direct: Math.max(0, summary.direct),
  group: Math.max(0, summary.group),
  ai: Math.max(0, summary.ai),
});

const getUnreadSummaryFromChats = (chats: ChatRecord[]): UnreadSummary => {
  const summary = chats.reduce<UnreadSummary>(
    (acc, chat) => {
      const unread = Math.max(0, chat.unreadCount ?? 0);
      acc.total += unread;
      if (chat.type === "DIRECT") acc.direct += unread;
      if (chat.type === "GROUP") acc.group += unread;
      if (chat.type === "AI") acc.ai += unread;
      return acc;
    },
    { total: 0, direct: 0, group: 0, ai: 0 }
  );
  return clampUnreadSummary(summary);
};

export const toUiMessage = (message: MessageRecord, currentUserId?: string): UiMessage => ({
  id: message.id,
  sender: message.senderId === currentUserId ? "me" : "them",
  senderId: message.senderId,
  kind: message.kind,
  systemEvent: message.systemEvent,
  systemActor: message.systemActor,
  content: message.deletedForEveryone ? "This message was deleted" : message.content ?? "",
  text: message.deletedForEveryone ? "This message was deleted" : message.content ?? "",
  decryptError: Boolean(message.decryptError),
  mediaUrl: message.mediaUrl ?? undefined,
  messageType: message.type,
  deletedForEveryone: message.deletedForEveryone,
  deletedAt: message.deletedAt,
  deletedById: message.deletedById,
  replyToId: message.replyToId ?? undefined,
  replyTo: message.replyTo
    ? {
        id: message.replyTo.id,
        senderId: message.replyTo.senderId,
        senderName: message.replyTo.sender.name,
        content: message.replyTo.deletedForEveryone
          ? "This message was deleted"
          : message.replyTo.content ?? "",
        decryptError: Boolean(message.replyTo.decryptError),
        mediaUrl: message.replyTo.mediaUrl ?? undefined,
        messageType: message.replyTo.type,
        deletedForEveryone: message.replyTo.deletedForEveryone,
      }
    : null,
  isForwarded: message.isForwarded,
  createdAt: message.createdAt,
  time: new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  }),
  status: toLowerMessageStatus(message.status),
  reactionSummary: message.reactionSummary ?? [],
});

export const toChatListItem = (chat: ChatRecord, currentUserId?: string): ChatListItem => {
  const lastMessage = chat.messages[0];
  const lastMessageTypeLabel = (() => {
    if (!lastMessage) return undefined;
    if (lastMessage.deletedForEveryone) return "This message was deleted";
    if (lastMessage.kind === "SYSTEM") return lastMessage.content ?? "System update";
    if (lastMessage.type === "IMAGE") return "Photo";
    if (lastMessage.type === "VIDEO") return "Video";
    if (lastMessage.type === "FILE") {
      if (lastMessage.content && /voice message/i.test(lastMessage.content)) return "Voice message";
      return lastMessage.content ?? "File";
    }
    return lastMessage.content ?? "";
  })();
  const rawPreview = lastMessageTypeLabel?.trim() || undefined;
  const senderPrefix = (() => {
    if (!lastMessage || !rawPreview || lastMessage.deletedForEveryone) return "";
    if (lastMessage.kind === "SYSTEM") return "";
    if (lastMessage.senderId === currentUserId) return "You: ";
    if (chat.type === "GROUP") return `${lastMessage.sender?.name ?? "Member"}: `;
    return "";
  })();
  const maxPreviewLength = 30;
  const fullPreview = rawPreview ? `${senderPrefix}${rawPreview}`.trim() : undefined;
  const preview =
    fullPreview && fullPreview.length > maxPreviewLength
      ? `${fullPreview.slice(0, maxPreviewLength - 1)}...`
      : fullPreview;

  if (chat.type === "GROUP") {
    return {
      chatId: chat.id,
      title: chat.group?.title ?? chat.group?.name ?? "Group",
      username: (chat.group?.title ?? chat.group?.name ?? "group")
        .toLowerCase()
        .replace(/\s+/g, "-"),
      avatar: chat.group?.avatar ?? undefined,
      lastMessage: preview,
      rawLastMessage: fullPreview,
      lastMessageAt: chat.lastMessageAt,
      isPinned: Boolean(chat.viewerParticipant?.pinned),
      pinnedAt: chat.viewerParticipant?.pinnedAt ?? undefined,
      isArchived: Boolean(chat.viewerParticipant?.archived),
      archivedAt: chat.viewerParticipant?.archivedAt ?? undefined,
      customOrder: chat.viewerParticipant?.customOrder ?? undefined,
      unreadCount: chat.unreadCount ?? 0,
      type: "GROUP",
      groupId: chat.group?.id,
      description: chat.group?.description ?? null,
      rulesText: chat.group?.rulesText ?? null,
    };
  }

  const peer =
    chat.participants.find((participant) => participant.userId !== currentUserId)?.user ??
    chat.participants[0]?.user;

  const username = peer?.username?.replace(/^@/, "") ?? chat.id;
  return {
    chatId: chat.id,
    title: peer?.name ?? username,
    username,
    avatar: peer?.avatar ?? undefined,
    peerUserId: peer?.id,
    lastMessage: preview,
    rawLastMessage: fullPreview,
    lastMessageAt: chat.lastMessageAt,
    isPinned: Boolean(chat.viewerParticipant?.pinned),
    pinnedAt: chat.viewerParticipant?.pinnedAt ?? undefined,
    isArchived: Boolean(chat.viewerParticipant?.archived),
    archivedAt: chat.viewerParticipant?.archivedAt ?? undefined,
    customOrder: chat.viewerParticipant?.customOrder ?? undefined,
    unreadCount: chat.unreadCount ?? 0,
    type: chat.type,
  };
};

export const useChatStore = create<ChatStore>()(
  withDevtools(
    (set) => ({
      chats: [],
      totalUnread: 0,
      unreadSummary: { total: 0, direct: 0, group: 0, ai: 0 },
      nearbyUsers: [],
      messagesByChatId: {},
      typingUsersByChatId: {},
      onlineUsers: new Set<string>(),
      isMultiSelect: false,
      selectedMessageIds: {},
      selectionAnchorId: null,
      selectionVersion: 0,
      setTotalUnread: (totalUnread) =>
        set((state) => ({
          totalUnread: Math.max(0, totalUnread),
          unreadSummary: {
            ...state.unreadSummary,
            total: Math.max(0, totalUnread),
          },
        })),
      setUnreadSummary: (summary) =>
        set({
          unreadSummary: clampUnreadSummary(summary),
          totalUnread: Math.max(0, summary.total),
        }),
      setChats: (chats) =>
        set(() => {
          const nextChats = sortChats(chats);
          const unreadSummary = getUnreadSummaryFromChats(nextChats);
          return {
            chats: nextChats,
            totalUnread: unreadSummary.total,
            unreadSummary,
          };
        }),
      upsertChat: (chat) =>
        set((state) => {
          const existing = state.chats.find((item) => item.id === chat.id);
          const merged = existing ? { ...existing, ...chat } : chat;
          const remaining = state.chats.filter((item) => item.id !== chat.id);
          const nextChats = sortChats([merged, ...remaining]);
          const unreadSummary = getUnreadSummaryFromChats(nextChats);

          return {
            chats: nextChats,
            totalUnread: unreadSummary.total,
            unreadSummary,
          };
        }),
      incrementUnreadForChat: (chatId, delta = 1) =>
        set((state) => {
          if (delta <= 0) return state;
          const targetChat = state.chats.find((chat) => chat.id === chatId);
          if (!targetChat) return state;

          const chats = state.chats.map((chat) =>
            chat.id === chatId
              ? { ...chat, unreadCount: Math.max(0, (chat.unreadCount ?? 0) + delta) }
              : chat
          );
          const unreadSummary = { ...state.unreadSummary };
          unreadSummary.total += delta;
          if (targetChat.type === "DIRECT") unreadSummary.direct += delta;
          if (targetChat.type === "GROUP") unreadSummary.group += delta;
          if (targetChat.type === "AI") unreadSummary.ai += delta;

          return {
            chats,
            totalUnread: Math.max(0, state.totalUnread + delta),
            unreadSummary: clampUnreadSummary(unreadSummary),
          };
        }),
      resetUnreadForChat: (chatId) =>
        set((state) => {
          const targetChat = state.chats.find((chat) => chat.id === chatId);
          const previousUnread = targetChat?.unreadCount ?? 0;
          if (!targetChat || previousUnread === 0) return state;

          const chats = state.chats.map((chat) =>
            chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
          );
          const unreadSummary = { ...state.unreadSummary };
          unreadSummary.total -= previousUnread;
          if (targetChat.type === "DIRECT") unreadSummary.direct -= previousUnread;
          if (targetChat.type === "GROUP") unreadSummary.group -= previousUnread;
          if (targetChat.type === "AI") unreadSummary.ai -= previousUnread;

          return {
            chats,
            totalUnread: Math.max(0, state.totalUnread - previousUnread),
            unreadSummary: clampUnreadSummary(unreadSummary),
          };
        }),
      applyUnreadUpdate: ({
        chatId,
        unreadCount,
        totalUnread,
        directUnread,
        groupUnread,
        aiUnread,
      }) =>
        set((state) => {
          const unreadSummary = clampUnreadSummary({
            total: totalUnread,
            direct: directUnread,
            group: groupUnread,
            ai: aiUnread,
          });
          if (!state.chats.some((chat) => chat.id === chatId)) {
            return {
              totalUnread: Math.max(0, totalUnread),
              unreadSummary,
            };
          }

          return {
            chats: state.chats.map((chat) =>
              chat.id === chatId ? { ...chat, unreadCount: Math.max(0, unreadCount) } : chat
            ),
            totalUnread: Math.max(0, totalUnread),
            unreadSummary,
          };
        }),
      setNearbyUsers: (users) => set({ nearbyUsers: users }),
      loadNearbyUsers: async () => {
        try {
          const users = await getNearbyUsers();
          set({ nearbyUsers: users });
        } catch (error) {
          console.error("Failed to load nearby users", error);
        }
      },
      removeNearbyUser: (userId) =>
        set((state) => ({
          nearbyUsers: state.nearbyUsers.filter((user) => user.id !== userId),
        })),
      setMessages: (chatId, messages) =>
        set((state) => ({
          messagesByChatId: {
            ...state.messagesByChatId,
            [chatId]: messages,
          },
        })),
      appendMessage: (message) =>
        set((state) => {
          const existingMessages = state.messagesByChatId[message.chatId] ?? [];
          const alreadyExists = existingMessages.some((item) => item.id === message.id);

          const nextMessages = alreadyExists
            ? existingMessages.map((item) => (item.id === message.id ? message : item))
            : [...existingMessages, message];

          const targetChat = state.chats.find((chat) => chat.id === message.chatId);
          const remainingChats = state.chats.filter((chat) => chat.id !== message.chatId);
          const nextChats = targetChat
            ? sortChats([
                {
                  ...targetChat,
                  lastMessageAt: message.createdAt,
                  messages: [
                    {
                      ...message,
                      sender: message.sender,
                    },
                  ],
                },
                ...remainingChats,
              ])
            : state.chats;

          return {
            messagesByChatId: {
              ...state.messagesByChatId,
              [message.chatId]: nextMessages,
            },
            chats: nextChats,
          };
        }),
      updateMessageStatus: (chatId, messageId, status) =>
        set((state) => {
          const existingMessages = state.messagesByChatId[chatId] ?? [];
          if (existingMessages.length === 0) return state;
          let changed = false;

          const nextMessages: MessageRecord[] = existingMessages.map((item) => {
            if (item.id !== messageId || item.status === status) {
              return item;
            }
            changed = true;
            return { ...item, status };
          });

          if (!changed) return state;

          return {
            messagesByChatId: {
              ...state.messagesByChatId,
              [chatId]: nextMessages,
            },
          };
        }),
      markMessagesReadByReader: (chatId, readerId) =>
        set((state) => {
          const existingMessages = state.messagesByChatId[chatId] ?? [];
          if (existingMessages.length === 0) return state;
          let changed = false;

          const nextMessages: MessageRecord[] = existingMessages.map((item) => {
            if (item.senderId === readerId || item.status === "READ") {
              return item;
            }
            changed = true;
            return { ...item, status: "READ" as MessageRecord["status"] };
          });

          if (!changed) return state;

          return {
            messagesByChatId: {
              ...state.messagesByChatId,
              [chatId]: nextMessages,
            },
          };
        }),
      removeMessage: (chatId, messageId) =>
        set((state) => ({
          messagesByChatId: {
            ...state.messagesByChatId,
            [chatId]: (state.messagesByChatId[chatId] ?? []).filter(
              (item) => item.id !== messageId
            ),
          },
        })),
      removeMessages: (chatId, messageIds) =>
        set((state) => {
          const ids = new Set(messageIds);
          if (ids.size === 0) return state;
          return {
            messagesByChatId: {
              ...state.messagesByChatId,
              [chatId]: (state.messagesByChatId[chatId] ?? []).filter((item) => !ids.has(item.id)),
            },
          };
        }),
      enterMultiSelect: (initialId) =>
        set(() => ({
          isMultiSelect: true,
          selectedMessageIds: initialId ? { [initialId]: true } : {},
          selectionAnchorId: initialId ?? null,
        })),
      toggleMessageSelected: (id) =>
        set((state) => {
          const next = { ...state.selectedMessageIds };
          if (next[id]) delete next[id];
          else next[id] = true;

          if (Object.keys(next).length === 0) {
            return {
              isMultiSelect: false,
              selectedMessageIds: {},
              selectionAnchorId: null,
            };
          }

          return {
            isMultiSelect: true,
            selectedMessageIds: next,
            selectionAnchorId: state.selectionAnchorId ?? id,
          };
        }),
      exitMultiSelect: () =>
        set((state) => ({
          isMultiSelect: false,
          selectedMessageIds: { ...state.selectedMessageIds },
          selectionAnchorId: state.selectionAnchorId,
        })),
      clearSelection: () =>
        set(() => ({
          selectedMessageIds: {},
          selectionAnchorId: null,
        })),
      resetMultiSelect: () =>
        set((state) => ({
          isMultiSelect: false,
          selectedMessageIds: {},
          selectionAnchorId: null,
          selectionVersion: state.selectionVersion + 1,
        })),
      markMessagesDeletedForEveryone: (chatId, messageIds, meta) =>
        set((state) => {
          const ids = new Set(messageIds);
          if (ids.size === 0) return state;

          const existingMessages = state.messagesByChatId[chatId] ?? [];
          if (existingMessages.length === 0) return state;

          const deletedAt = meta?.deletedAt ?? new Date().toISOString();
          const deletedById = meta?.deletedById ?? null;
          let changed = false;

          const nextMessages = existingMessages.map((item) => {
            if (!ids.has(item.id)) return item;
            changed = true;
            return {
              ...item,
              content: null,
              mediaUrl: null,
              type: "TEXT" as const,
              deletedForEveryone: true,
              deletedAt,
              deletedById,
            };
          });

          if (!changed) return state;

          return {
            messagesByChatId: {
              ...state.messagesByChatId,
              [chatId]: nextMessages,
            },
            chats: state.chats.map((chat) => {
              if (chat.id !== chatId || chat.messages.length === 0) return chat;
              const preview = chat.messages[0];
              if (!ids.has(preview.id)) return chat;
              return {
                ...chat,
                messages: [
                  {
                    ...preview,
                    content: null,
                    mediaUrl: null,
                    type: "TEXT" as const,
                    deletedForEveryone: true,
                    deletedAt,
                    deletedById,
                  },
                ],
              };
            }),
          };
        }),
      setTypingUser: (chatId, userId) =>
        set((state) => {
          const current = state.typingUsersByChatId[chatId] ?? [];
          if (current.includes(userId)) return state;
          return {
            typingUsersByChatId: {
              ...state.typingUsersByChatId,
              [chatId]: [...current, userId],
            },
          };
        }),
      stopTypingUser: (chatId, userId) =>
        set((state) => {
          const current = state.typingUsersByChatId[chatId] ?? [];
          if (!current.includes(userId)) return state;
          const next = current.filter((item) => item !== userId);
          return {
            typingUsersByChatId: {
              ...state.typingUsersByChatId,
              [chatId]: next,
            },
          };
        }),
      clearTypingUsersForChat: (chatId) =>
        set((state) => ({
          typingUsersByChatId: {
            ...state.typingUsersByChatId,
            [chatId]: [],
          },
        })),
      setOnlineUsers: (userIds) =>
        set({
          onlineUsers: new Set(userIds),
        }),
      setUserOnline: (userId) =>
        set((state) => {
          if (state.onlineUsers.has(userId)) return state;
          const next = new Set(state.onlineUsers);
          next.add(userId);
          return { onlineUsers: next };
        }),
      setUserOffline: (userId) =>
        set((state) => {
          if (!state.onlineUsers.has(userId)) return state;
          const next = new Set(state.onlineUsers);
          next.delete(userId);
          return { onlineUsers: next };
        }),
      applyParticipantState: (chatId, patch) =>
        set((state) => {
          const chats = state.chats.map((chat) => {
            if (chat.id !== chatId) return chat;
            return {
              ...chat,
              viewerParticipant: {
                ...(chat.viewerParticipant ?? {
                  chatId,
                  pinned: false,
                  pinnedAt: null,
                  archived: false,
                  archivedAt: null,
                  customOrder: null,
                }),
                ...patch,
              },
            };
          });
          return { chats: sortChats(chats) };
        }),
      applyChatCustomOrder: (orders) =>
        set((state) => {
          if (orders.length === 0) return state;
          const orderMap = new Map(orders.map((item) => [item.chatId, item.order]));
          const chats = state.chats.map((chat) => {
            const order = orderMap.get(chat.id);
            if (typeof order !== "number") return chat;
            return {
              ...chat,
              viewerParticipant: {
                ...(chat.viewerParticipant ?? {
                  chatId: chat.id,
                  pinned: false,
                  pinnedAt: null,
                  archived: false,
                  archivedAt: null,
                  customOrder: null,
                }),
                customOrder: order,
              },
            };
          });
          return { chats: sortChats(chats) };
        }),
      applyGroupPatch: (groupId, patch) =>
        set((state) => ({
          chats: state.chats.map((chat) => {
            if (chat.type !== "GROUP" || chat.group?.id !== groupId) return chat;
            return {
              ...chat,
              group: {
                ...(chat.group ?? {
                  id: groupId,
                  title: "Group",
                  name: "Group",
                  avatar: null,
                  description: null,
                  rulesText: null,
                  chatId: chat.id,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }),
                ...(patch.title !== undefined
                  ? { title: patch.title, name: patch.title }
                  : {}),
                ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
                ...(patch.description !== undefined ? { description: patch.description } : {}),
                ...(patch.rulesText !== undefined ? { rulesText: patch.rulesText } : {}),
              },
            };
          }),
        })),
      reset: () =>
        set({
          chats: [],
          totalUnread: 0,
          unreadSummary: { total: 0, direct: 0, group: 0, ai: 0 },
          nearbyUsers: [],
          messagesByChatId: {},
          typingUsersByChatId: {},
          onlineUsers: new Set<string>(),
          isMultiSelect: false,
          selectedMessageIds: {},
          selectionAnchorId: null,
          selectionVersion: 0,
        }),
    }),
    "chatStore"
  )
);
