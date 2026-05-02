import { api } from "./api";
import type {
  ApiEnvelope,
  MessageReactionDetailsRecord,
  MessageRecord,
} from "./types";

export const fetchMessages = async (chatId: string, limit = 50) => {
  const response = await api.get<
    ApiEnvelope<{
      items: MessageRecord[];
      nextCursor: string | null;
    }>
  >(`/messages/${chatId}`, {
    params: { limit },
  });

  return response.data.data;
};

export const sendMessage = async (payload: {
  chatId: string;
  content?: string;
  mediaUrl?: string;
  type?: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  replyToId?: string;
}) => {
  const response = await api.post<ApiEnvelope<{ message: MessageRecord }>>(
    "/messages",
    payload
  );
  return response.data.data.message;
};

export const forwardMessages = async (payload: {
  messageIds: string[];
  targetChatIds: string[];
}) => {
  const response = await api.post<ApiEnvelope<{ messages: MessageRecord[] }>>(
    "/messages/forward",
    payload
  );
  return response.data.data.messages;
};

export const markChatRead = async (chatId: string) => {
  const response = await api.patch<ApiEnvelope<{ updatedCount: number }>>(
    `/messages/read/${chatId}`
  );
  return response.data.data.updatedCount;
};

export const deleteMessage = async (messageId: string) => {
  const response = await api.post<
    ApiEnvelope<{
      scope: "ME" | "EVERYONE";
      deletedMessageIds: string[];
      failed: Array<{ id: string; reason: string }>;
    }>
  >("/messages/delete", {
    messageIds: [messageId],
    scope: "ME",
  });
  return response.data.data.deletedMessageIds.includes(messageId);
};

export const deleteMessages = async (payload: {
  messageIds: string[];
  scope: "ME" | "EVERYONE";
}) => {
  const response = await api.post<
    ApiEnvelope<{
      scope: "ME" | "EVERYONE";
      successIds?: string[];
      deletedMessageIds?: string[];
      deletedMessages?: Array<{
        id: string;
        chatId: string;
        deletedForEveryone: boolean;
        deletedAt: string | null;
        deletedById: string | null;
      }>;
      failed: Array<{ id: string; reason: string }>;
    }>
  >("/messages/delete", payload);
  return response.data.data;
};

export const toggleMessageReaction = async (
  messageId: string,
  emoji: string
) => {
  const response = await api.post<
    ApiEnvelope<{
      messageId: string;
      emoji: string;
      action: "ADDED" | "REMOVED";
      summary: Array<{ emoji: string; count: number; reactedByMe: boolean }>;
    }>
  >(`/messages/${messageId}/react`, { emoji });

  return response.data.data;
};

export const fetchMessageReactions = async (messageId: string) => {
  const response = await api.get<
    ApiEnvelope<{
      messageId: string;
      reactions: MessageReactionDetailsRecord[];
    }>
  >(`/messages/${messageId}/reactions`);

  return response.data.data;
};
