import { api } from "./api";
import type { ApiEnvelope, BlockedUserRecord } from "./types";

export const fetchBlockedUsers = async () => {
  const response = await api.get<ApiEnvelope<{ blocks: BlockedUserRecord[] }>>("/blocks");
  return response.data.data.blocks;
};

export const blockUser = async (payload: { userId?: string; username?: string }) => {
  const response = await api.post<
    ApiEnvelope<{
      blockedUser: { userId: string; username: string; avatar: string | null };
    }>
  >("/blocks", payload);
  return response.data.data.blockedUser;
};

export const unblockUser = async (userId: string) => {
  const response = await api.delete<ApiEnvelope<{ unblockedUserId: string }>>(`/blocks/${userId}`);
  return response.data.data.unblockedUserId;
};
