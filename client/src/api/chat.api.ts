import { api } from "./api";
import type { ApiEnvelope, ChatRecord, UnreadSummary } from "./types";

export const fetchChats = async () => {
  const response = await api.get<ApiEnvelope<{ chats: ChatRecord[] }>>("/chats");
  return response.data.data.chats;
};

export const createDirectChat = async (payload: { userId: string }) => {
  const response = await api.post<ApiEnvelope<{ chat: ChatRecord }>>(
    "/chats/direct",
    payload
  );
  return response.data.data.chat;
};

export const createOrGetPrivateChat = async (payload: {
  userId?: string;
  username?: string;
}) => {
  const response = await api.post<ApiEnvelope<{ chat: ChatRecord }>>(
    "/chats/private",
    payload
  );
  return response.data.data.chat;
};

export const leaveChat = async (chatId: string) => {
  const response = await api.delete<ApiEnvelope<{ ok: boolean }>>(`/chats/${chatId}`);
  return response.data.data.ok;
};

export const markChatAsRead = async (chatId: string) => {
  const response = await api.patch<ApiEnvelope<{ chatId: string; lastReadAt: string }>>(
    `/chats/${chatId}/read`
  );
  return response.data.data;
};

export const fetchTotalUnread = async () => {
  const response = await api.get<ApiEnvelope<{ total: number }>>("/chats/unread/total");
  return response.data.data.total;
};

export const fetchUnreadSummary = async (): Promise<UnreadSummary> => {
  const response = await api.get<ApiEnvelope<UnreadSummary>>("/chats/unread/summary");
  return response.data.data;
};

export const togglePinChat = async (chatId: string) => {
  const response = await api.patch<
    ApiEnvelope<{
      chatId: string;
      pinned: boolean;
      pinnedAt: string | null;
      archived: boolean;
      archivedAt: string | null;
      customOrder: number | null;
    }>
  >(`/chats/${chatId}/pin`);
  return response.data.data;
};

export const archiveChat = async (chatId: string) => {
  const response = await api.patch<
    ApiEnvelope<{
      chatId: string;
      pinned: boolean;
      pinnedAt: string | null;
      archived: boolean;
      archivedAt: string | null;
      customOrder: number | null;
    }>
  >(`/chats/${chatId}/archive`);
  return response.data.data;
};

export const unarchiveChat = async (chatId: string) => {
  const response = await api.patch<
    ApiEnvelope<{
      chatId: string;
      pinned: boolean;
      pinnedAt: string | null;
      archived: boolean;
      archivedAt: string | null;
      customOrder: number | null;
    }>
  >(`/chats/${chatId}/unarchive`);
  return response.data.data;
};

export const reorderChats = async (orders: Array<{ chatId: string; order: number }>) => {
  const response = await api.patch<ApiEnvelope<{ updatedCount: number }>>("/chats/reorder", orders);
  return response.data.data.updatedCount;
};
