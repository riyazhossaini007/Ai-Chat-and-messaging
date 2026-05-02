import { api } from "./api";
import type {
  ApiEnvelope,
  GroupDetailsRecord,
  GroupInviteRecord,
  GroupRole,
  GroupSummaryRecord,
  MessageRecord,
} from "./types";

export const createGroup = async (payload: {
  title: string;
  avatar?: string | null;
  description?: string | null;
  memberIds?: string[];
}) => {
  const response = await api.post<ApiEnvelope<{ group: GroupDetailsRecord }>>(
    "/groups",
    payload
  );
  return response.data.data.group;
};

export const fetchMyGroups = async () => {
  const response = await api.get<ApiEnvelope<{ groups: GroupSummaryRecord[] }>>("/groups");
  return response.data.data.groups;
};

export const fetchGroupDetails = async (groupId: string) => {
  const response = await api.get<ApiEnvelope<{ group: GroupDetailsRecord }>>(
    `/groups/${groupId}`
  );
  return response.data.data.group;
};

export const patchGroup = async (
  groupId: string,
  payload: { title?: string; avatar?: string | null; description?: string | null }
) => {
  const response = await api.patch<ApiEnvelope<{ group: GroupDetailsRecord }>>(
    `/groups/${groupId}`,
    payload
  );
  return response.data.data.group;
};

export const patchGroupRules = async (groupId: string, rulesText: string) => {
  const response = await api.patch<ApiEnvelope<{ group: GroupDetailsRecord }>>(
    `/groups/${groupId}/rules`,
    { rulesText }
  );
  return response.data.data.group;
};

export const addGroupMembers = async (groupId: string, userIds: string[]) => {
  const response = await api.post<
    ApiEnvelope<{ addedUserIds: string[]; systemMessages: MessageRecord[] }>
  >(`/groups/${groupId}/members`, { userIds });
  return response.data.data;
};

export const removeGroupMember = async (groupId: string, userId: string) => {
  const response = await api.delete<ApiEnvelope<{ ok: boolean }>>(
    `/groups/${groupId}/members/${userId}`
  );
  return response.data.data.ok;
};

export const leaveGroup = async (groupId: string, newAdminUserId?: string) => {
  const response = await api.post<ApiEnvelope<{ ok: boolean }>>(`/groups/${groupId}/leave`, {
    newAdminUserId,
  });
  return response.data.data.ok;
};

export const transferGroupCreator = async (
  groupId: string,
  newCreatorUserId: string
) => {
  const response = await api.post<
    ApiEnvelope<{ ok: boolean; previousCreatorId: string; newCreatorId: string }>
  >(`/groups/${groupId}/transfer-creator`, { newCreatorUserId });
  return response.data.data;
};

export const setGroupAdminRole = async (
  groupId: string,
  payload: { userId: string; action: "PROMOTE" | "DEMOTE" }
) => {
  const response = await api.patch<ApiEnvelope<{ role: GroupRole }>>(
    `/groups/${groupId}/admin-role`,
    payload
  );
  return response.data.data.role;
};

export const createGroupInvite = async (
  groupId: string,
  expiresAt?: string | null
) => {
  const response = await api.post<
    ApiEnvelope<{ inviteUrl: string; token: string; expiresAt: string | null }>
  >(`/groups/${groupId}/invite`, { expiresAt });
  return response.data.data;
};

export const revokeGroupInvite = async (groupId: string) => {
  const response = await api.post<ApiEnvelope<{ ok: boolean; invite: GroupInviteRecord | null }>>(
    `/groups/${groupId}/invite/revoke`
  );
  return response.data.data;
};

export const joinGroupByToken = async (token: string) => {
  const response = await api.post<
    ApiEnvelope<{ alreadyMember: boolean; groupId: string; message: MessageRecord | null }>
  >(`/groups/join/${token}`);
  return response.data.data;
};

export const fetchGroupMessages = async (groupId: string, limit = 100) => {
  const response = await api.get<
    ApiEnvelope<{
      items: MessageRecord[];
      nextCursor: string | null;
    }>
  >(`/groups/${groupId}/messages`, {
    params: { limit },
  });
  return response.data.data;
};

export const fetchGroupMessagesAround = async (
  groupId: string,
  messageId: string,
  window = 20
) => {
  const response = await api.get<
    ApiEnvelope<{
      targetMessageId: string;
      items: MessageRecord[];
    }>
  >(`/groups/${groupId}/messages/around/${messageId}`, {
    params: { window },
  });
  return response.data.data;
};

export const postGroupMessage = async (
  groupId: string,
  payload: {
    text: string;
    replyToId?: string;
    mediaUrl?: string;
    mediaType?: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  }
) => {
  const response = await api.post<ApiEnvelope<{ message: MessageRecord }>>(
    `/groups/${groupId}/messages`,
    payload
  );
  return response.data.data.message;
};

export const deleteGroup = async (groupId: string) => {
  const response = await api.delete<ApiEnvelope<{ ok: boolean }>>(`/groups/${groupId}`);
  return response.data.data.ok;
};

export const markGroupMessagesRead = async (groupId: string, messageIds: string[]) => {
  const response = await api.post<
    ApiEnvelope<{
      items: Array<{
        messageId: string;
        userId: string;
        readAt: string;
        readCount: number;
      }>;
    }>
  >(`/groups/${groupId}/read`, {
    messageIds,
  });
  return response.data.data.items;
};

export const fetchMessageReads = async (messageId: string) => {
  const response = await api.get<
    ApiEnvelope<{
      reads: Array<{
        userId: string;
        username: string;
        avatar: string | null;
        readAt: string;
      }>;
    }>
  >(`/messages/${messageId}/reads`);
  return response.data.data.reads;
};
