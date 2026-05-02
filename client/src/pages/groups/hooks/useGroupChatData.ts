import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchGroupDetails,
  fetchGroupMessages,
  fetchGroupMessagesAround,
  markGroupMessagesRead,
} from "../../../api/group.api";
import { getApiErrorCode, getApiErrorMessage } from "../../../api/api";
import type { GroupDetailsRecord, MessageRecord } from "../../../api/types";
import { getSocket } from "../../../lib/socket";
import { readHiddenGroupMessages, writeHiddenGroupMessages } from "../groupChat.storage";
import { normalizeGroupMessage, type GroupClientMessage } from "../groupChat.utils";

type UseGroupChatDataArgs = {
  groupId: string;
  authUserId?: string;
  resetUnreadForChat: (chatId: string) => void;
};

const useGroupChatData = ({ groupId, authUserId, resetUnreadForChat }: UseGroupChatDataArgs) => {
  const [group, setGroup] = useState<GroupDetailsRecord | null>(null);
  const [messages, setMessages] = useState<GroupClientMessage[]>([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const readSubmittedRef = useRef<Set<string>>(new Set());
  const hiddenMessageIdsRef = useRef<Set<string>>(new Set());

  const filterHiddenMessages = useCallback(
    <T extends { id: string }>(items: T[]) => items.filter((item) => !hiddenMessageIdsRef.current.has(item.id)),
    []
  );

  const rememberHiddenMessages = useCallback(
    (messageIds: string[]) => {
      if (messageIds.length === 0) return;
      messageIds.forEach((id) => hiddenMessageIdsRef.current.add(id));
      const hiddenMap = readHiddenGroupMessages();
      const existing = new Set(hiddenMap[groupId] ?? []);
      messageIds.forEach((id) => existing.add(id));
      hiddenMap[groupId] = Array.from(existing);
      writeHiddenGroupMessages(hiddenMap);
    },
    [groupId]
  );

  const refreshGroup = useCallback(async () => {
    try {
      const details = await fetchGroupDetails(groupId);
      setGroup(details);
      setAccessDenied(false);
      setLoadError(null);
      return details;
    } catch (error) {
      if (getApiErrorCode(error) === "NOT_A_MEMBER") {
        setAccessDenied(true);
      }
      setLoadError(getApiErrorMessage(error));
      throw error;
    }
  }, [groupId]);

  useEffect(() => {
    const hiddenMap = readHiddenGroupMessages();
    hiddenMessageIdsRef.current = new Set(hiddenMap[groupId] ?? []);
  }, [groupId]);

  useEffect(() => {
    readSubmittedRef.current = new Set();
    const run = async () => {
      try {
        const details = await fetchGroupDetails(groupId);
        setGroup(details);
        setAccessDenied(false);
        setLoadError(null);
        const data = await fetchGroupMessages(groupId, 100);
        const next = [...data.items].reverse().map((item) => normalizeGroupMessage(item));
        setMessages(filterHiddenMessages(next));
      } catch (error) {
        if (getApiErrorCode(error) === "NOT_A_MEMBER") {
          setAccessDenied(true);
        }
        setLoadError(getApiErrorMessage(error));
      }
    };
    void run();
  }, [filterHiddenMessages, groupId]);

  useEffect(() => {
    if (!group?.chatId) return;
    resetUnreadForChat(group.chatId);
  }, [group?.chatId, resetUnreadForChat]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !group?.chatId) return;

    const onMessage = (payload: MessageRecord) => {
      if (payload.chatId !== group.chatId) return;
      if (hiddenMessageIdsRef.current.has(payload.id)) return;
      setMessages((prev) => {
        const normalized = normalizeGroupMessage(payload);
        if (prev.some((item) => item.id === normalized.id)) return prev;
        if (normalized.senderId === authUserId) {
          const sendingIndex = prev.findIndex(
            (item) =>
              item.localStatus === "SENDING" &&
              item.senderId === normalized.senderId &&
              item.content === normalized.content
          );
          if (sendingIndex >= 0) {
            const next = [...prev];
            next[sendingIndex] = normalized;
            return next;
          }
        }
        return [...prev, normalized];
      });
    };

    const onDelivered = (payload: { messageId: string; deliveredToAtLeastOne: boolean }) => {
      if (!payload.deliveredToAtLeastOne) return;
      setMessages((prev) =>
        prev.map((message) =>
          message.id === payload.messageId ? { ...message, deliveredToAtLeastOne: true } : message
        )
      );
    };

    const onRead = (payload: {
      chatId: string;
      groupId: string;
      messageId: string;
      userId: string;
      readAt: string;
      readCount: number;
    }) => {
      if (payload.chatId !== group.chatId || payload.groupId !== groupId) return;
      setMessages((prev) =>
        prev.map((message) =>
          message.id === payload.messageId ? { ...message, readCount: Math.max(message.readCount ?? 0, payload.readCount) } : message
        )
      );
    };

    const onMessageDeleted = (payload: {
      chatId: string;
      messageIds: string[];
      deletedById: string;
      deletedAt: string;
    }) => {
      if (payload.chatId !== group.chatId) return;
      const deletedSet = new Set(payload.messageIds);
      setMessages((prev) =>
        prev.map((message) => {
          const isDeleted = deletedSet.has(message.id);
          const updatedReplyTo =
            message.replyTo && deletedSet.has(message.replyTo.id)
              ? {
                  ...message.replyTo,
                  deletedForEveryone: true,
                  content: "This message was deleted",
                  mediaUrl: null,
                  type: "TEXT" as const,
                }
              : message.replyTo;

          if (isDeleted) {
            return {
              ...message,
              deletedForEveryone: true,
              deletedAt: payload.deletedAt,
              deletedById: payload.deletedById,
              content: "This message was deleted",
              text: "This message was deleted",
              mediaUrl: null,
              type: "TEXT" as const,
            };
          }

          if (updatedReplyTo !== message.replyTo) {
            return { ...message, replyTo: updatedReplyTo };
          }
          return message;
        })
      );
    };

    const onReactionUpdated = (payload: {
      messageId: string;
      chatType: "DM" | "GROUP" | "AI";
      chatId: string;
      groupId?: string | null;
      summary: Array<{ emoji: string; count: number }>;
      actorUserId: string;
      emoji: string;
      action: "ADDED" | "REMOVED";
    }) => {
      if (payload.chatId !== group.chatId) return;
      if (payload.actorUserId === authUserId) return;

      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== payload.messageId) return message;
          const prior = message.reactionSummary ?? [];
          return {
            ...message,
            reactionSummary: payload.summary.map((item) => ({
              emoji: item.emoji,
              count: item.count,
              reactedByMe: prior.find((existing) => existing.emoji === item.emoji)?.reactedByMe ?? false,
            })),
          };
        })
      );
    };

    const onMemberLeft = (payload: { groupId: string; userId: string; at: string }) => {
      if (payload.groupId !== groupId) return;
      if (payload.userId === authUserId) {
        setAccessDenied(true);
      }
      setGroup((prev) => {
        if (!prev) return prev;
        const nextMembers = prev.members.filter((member) => member.userId !== payload.userId);
        const nextRole = payload.userId === authUserId ? "MEMBER" : prev.myRole;
        return {
          ...prev,
          members: nextMembers,
          memberCount: Math.max(0, prev.memberCount - 1),
          myRole: nextRole,
        };
      });
    };

    const onRoleUpdated = (payload: {
      groupId: string;
      userId: string;
      role: "CREATOR" | "ADMIN" | "MEMBER";
      previousRole?: "CREATOR" | "ADMIN" | "MEMBER";
      at: string;
      isCreatorTransfer?: boolean;
    }) => {
      void payload.previousRole;
      void payload.at;
      void payload.isCreatorTransfer;
      if (payload.groupId !== groupId) return;
      setGroup((prev) => {
        if (!prev) return prev;
        const nextMembers = prev.members.map((member) =>
          member.userId === payload.userId ? { ...member, role: payload.role } : member
        );
        return {
          ...prev,
          myRole: payload.userId === authUserId ? payload.role : prev.myRole,
          creatorId: payload.role === "CREATOR" ? payload.userId : prev.creatorId,
          members: nextMembers,
        };
      });
    };

    socket.on("group:message_new", onMessage);
    socket.on("group:message_delivered", onDelivered);
    socket.on("group:message_read", onRead);
    socket.on("message_deleted", onMessageDeleted);
    socket.on("message_reaction_updated", onReactionUpdated);
    socket.on("group:member_left", onMemberLeft);
    socket.on("group:role_updated", onRoleUpdated);
    return () => {
      socket.off("group:message_new", onMessage);
      socket.off("group:message_delivered", onDelivered);
      socket.off("group:message_read", onRead);
      socket.off("message_deleted", onMessageDeleted);
      socket.off("message_reaction_updated", onReactionUpdated);
      socket.off("group:member_left", onMemberLeft);
      socket.off("group:role_updated", onRoleUpdated);
    };
  }, [authUserId, group?.chatId, groupId]);

  useEffect(() => {
    if (accessDenied) return;
    if (!authUserId) return;
    const unreadIds = messages
      .filter(
        (message) =>
          message.kind === "USER" &&
          !message.localStatus &&
          message.senderId !== authUserId &&
          !readSubmittedRef.current.has(message.id)
      )
      .map((message) => message.id);

    if (unreadIds.length === 0) return;
    unreadIds.forEach((id) => readSubmittedRef.current.add(id));
    if (group?.chatId) {
      resetUnreadForChat(group.chatId);
    }
    void markGroupMessagesRead(groupId, unreadIds).catch((error) => {
      unreadIds.forEach((id) => readSubmittedRef.current.delete(id));
      console.error("Failed to mark group messages as read", error);
    });
  }, [accessDenied, authUserId, group?.chatId, groupId, messages, resetUnreadForChat]);

  const focusMessage = useCallback((messageId: string) => {
    const el = messageRefs.current[messageId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => {
      setHighlightedMessageId((prev) => (prev === messageId ? null : prev));
    }, 2500);
  }, []);

  const jumpToMessage = useCallback(
    async (messageId: string) => {
      const exists = messages.some((message) => message.id === messageId);
      if (exists) {
        focusMessage(messageId);
        return;
      }

      try {
        const around = await fetchGroupMessagesAround(groupId, messageId, 20);
        setMessages((prev) => {
          const merged = new Map(prev.map((item) => [item.id, item]));
          around.items.forEach((item) => {
            if (!hiddenMessageIdsRef.current.has(item.id)) {
              merged.set(item.id, normalizeGroupMessage(item));
            }
          });
          return Array.from(merged.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
        window.setTimeout(() => {
          focusMessage(messageId);
        }, 120);
      } catch {
        setHighlightedMessageId(null);
      }
    },
    [focusMessage, groupId, messages]
  );

  return {
    group,
    messages,
    setMessages,
    refreshGroup,
    jumpToMessage,
    rememberHiddenMessages,
    messageRefs,
    highlightedMessageId,
    accessDenied,
    loadError,
  };
};

export { useGroupChatData };
