import type { Socket } from "socket.io";
import type { AuthUser } from "../types";

export interface RealtimeMessagePayload {
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
  content: string | null;
  decryptError?: boolean;
  mediaUrl: string | null;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
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
  systemActor: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
  } | null;
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
    senderId: string | null;
    createdAt: string;
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
    mediaType?: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
    isDeletedForEveryone?: boolean;
    kind: "USER" | "SYSTEM";
  } | null;
  isForwarded: boolean;
  forwardFromMessageId: string | null;
  forwardFromSenderId: string | null;
  createdAt: string;
  status: "SENT" | "DELIVERED" | "READ";
  readCount?: number;
  deliveredToAtLeastOne?: boolean;
  reactionSummary?: Array<{
    emoji: string;
    count: number;
    reactedByMe: boolean;
  }>;
}

export interface MessageStatusPayload {
  chatId: string;
  messageId: string;
  status: "SENT" | "DELIVERED" | "READ";
}

export interface MessageReadPayload {
  chatId: string;
  readerId: string;
}

export interface GroupMessageDeliveredPayload {
  messageId: string;
  deliveredToAtLeastOne: boolean;
}

export interface GroupMessageReadPayload {
  chatId: string;
  groupId: string;
  messageId: string;
  userId: string;
  readAt: string;
  readCount: number;
}

export interface MessageDeletedPayload {
  chatId: string;
  messageIds: string[];
  deletedById: string;
  deletedAt: string;
}

export interface MessageReactionUpdatedPayload {
  messageId: string;
  chatType: "DM" | "GROUP" | "AI";
  chatId: string;
  groupId?: string | null;
  summary: Array<{ emoji: string; count: number }>;
  actorUserId: string;
  emoji: string;
  action: "ADDED" | "REMOVED";
}

export interface TypingPayload {
  chatId: string;
}

export interface DeliveredPayload {
  chatId: string;
  messageId: string;
}

export interface MarkReadPayload {
  chatId: string;
}

export interface JoinChatPayload {
  chatId: string;
}

export interface CallActionPayload {
  callId: string;
}

export interface CallStartPayload {
  type: "VOICE" | "VIDEO";
  peerUserId?: string;
  chatId?: string;
  isGroup?: boolean;
}

export interface CallHeartbeatPayload {
  callId: string;
  ts?: number;
}

export interface WebRtcPayload {
  callId: string;
  toUserId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  meta?: Record<string, unknown>;
}

export interface SocketErrorPayload {
  code: string;
  message: string;
}

export interface UnreadUpdatePayload {
  chatId: string;
  unreadCount: number;
  totalUnread: number;
  directUnread: number;
  groupUnread: number;
  aiUnread: number;
  unreadCountDelta: number;
  totalUnreadDelta: number;
}

export interface UnreadResetPayload {
  chatId: string;
  unreadCount: number;
}

export interface AiTurnPayload {
  id: string;
  threadId: string;
  role: "USER" | "AI";
  content: string;
  meta?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ServerToClientEvents {
  new_message: (payload: RealtimeMessagePayload) => void;
  "group:message_new": (payload: RealtimeMessagePayload) => void;
  "group:updated": (payload: {
    groupId: string;
    title: string;
    avatar: string | null;
    description: string | null;
    rulesText: string | null;
    memberCount: number;
    updatedAt: string;
  }) => void;
  "group:members_updated": (payload: {
    groupId: string;
    memberCount: number;
    action: "ADD" | "REMOVE" | "PROMOTE" | "DEMOTE" | "LEAVE" | "JOIN";
    userIds?: string[];
    updatedAt: string;
  }) => void;
  "group:member_left": (payload: {
    groupId: string;
    userId: string;
    at: string;
  }) => void;
  "group:role_updated": (payload: {
    groupId: string;
    userId: string;
    role: "CREATOR" | "ADMIN" | "MEMBER";
    previousRole?: "CREATOR" | "ADMIN" | "MEMBER";
    at: string;
    isCreatorTransfer?: boolean;
  }) => void;
  "group:invite_updated": (payload: {
    groupId: string;
    token: string | null;
    revokedAt: string | null;
    expiresAt: string | null;
    updatedAt: string;
  }) => void;
  message_status_update: (payload: MessageStatusPayload) => void;
  message_read: (payload: MessageReadPayload) => void;
  "group:message_delivered": (payload: GroupMessageDeliveredPayload) => void;
  "group:message_read": (payload: GroupMessageReadPayload) => void;
  message_deleted: (payload: MessageDeletedPayload) => void;
  message_reaction_updated: (payload: MessageReactionUpdatedPayload) => void;
  typing: (payload: { chatId: string; userId: string }) => void;
  stop_typing: (payload: { chatId: string; userId: string }) => void;
  online_users: (payload: { userIds: string[] }) => void;
  user_online: (payload: { userId: string }) => void;
  user_offline: (payload: { userId: string }) => void;
  unread_update: (payload: UnreadUpdatePayload) => void;
  unread_reset: (payload: UnreadResetPayload) => void;
  ai_turn_created: (payload: { threadId: string; turn: AiTurnPayload }) => void;
  ai_turn_updated: (payload: { threadId: string; turn: AiTurnPayload }) => void;
  ai_thread_updated: (payload: { threadId: string; updatedAt: string }) => void;
  "call:incoming": (payload: {
    callId: string;
    fromUserId: string;
    type: "VOICE" | "VIDEO";
    isGroup: boolean;
    chatId: string | null;
    participants: string[];
    state: string;
    expiresAt: string;
  }) => void;
  "call:ringing": (payload: {
    callId: string;
    type?: "VOICE" | "VIDEO";
    isGroup?: boolean;
    chatId?: string | null;
    state: string;
    participants?: string[];
    expiresAt?: string;
    reconnectedUserId?: string;
  }) => void;
  "call:accepted": (payload: {
    callId: string;
    acceptedBy: string;
    state: string;
    startedAt: string;
  }) => void;
  "call:declined": (payload: {
    callId: string;
    declinedBy: string;
    state: string;
  }) => void;
  "call:ended": (payload: {
    callId: string;
    state: string;
    endedAt: string;
  }) => void;
  "call:missed": (payload: {
    callId: string;
    state: string;
  }) => void;
  "call:busy": (payload: {
    callId: string;
    userId: string;
  }) => void;
  "call:failed": (payload: {
    callId: string;
    reason: string;
  }) => void;
  "webrtc:offer": (payload: {
    callId: string;
    fromUserId: string;
    toUserId: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    meta?: Record<string, unknown>;
  }) => void;
  "webrtc:answer": (payload: {
    callId: string;
    fromUserId: string;
    toUserId: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    meta?: Record<string, unknown>;
  }) => void;
  "webrtc:ice": (payload: {
    callId: string;
    fromUserId: string;
    toUserId: string;
    candidate?: RTCIceCandidateInit;
    meta?: Record<string, unknown>;
  }) => void;
  "webrtc:renegotiate": (payload: {
    callId: string;
    fromUserId: string;
    toUserId: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    meta?: Record<string, unknown>;
  }) => void;
  "call:error": (payload: {
    code: string;
    message: string;
    callId?: string;
  }) => void;
  socket_error: (payload: SocketErrorPayload) => void;
}

export interface ClientToServerEvents {
  join_chat: (payload: JoinChatPayload) => void;
  typing: (payload: TypingPayload) => void;
  stop_typing: (payload: TypingPayload) => void;
  message_delivered: (payload: DeliveredPayload) => void;
  mark_read: (payload: MarkReadPayload) => void;
  "call:start": (payload: CallStartPayload) => void;
  "call:cancel": (payload: CallActionPayload) => void;
  "call:accept": (payload: CallActionPayload) => void;
  "call:decline": (payload: CallActionPayload) => void;
  "call:end": (payload: CallActionPayload) => void;
  "webrtc:offer": (payload: WebRtcPayload) => void;
  "webrtc:answer": (payload: WebRtcPayload) => void;
  "webrtc:ice": (payload: WebRtcPayload) => void;
  "webrtc:renegotiate": (payload: WebRtcPayload) => void;
  "call:heartbeat": (payload: CallHeartbeatPayload) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  user: AuthUser;
}

export type IOServer = import("socket.io").Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type AuthenticatedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
