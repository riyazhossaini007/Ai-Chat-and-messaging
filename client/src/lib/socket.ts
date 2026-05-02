import { io, type Socket } from "socket.io-client";
import { getApiBaseUrl } from "./api";
import { getAuthToken } from "./authStorage";

type ServerToClientEvents = {
  online_users: (payload: { userIds: string[] }) => void;
  user_online: (payload: { userId: string }) => void;
  user_offline: (payload: { userId: string }) => void;
  new_message: (payload: {
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
    decryptError?: boolean;
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
      decryptError?: boolean;
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
    readCount?: number;
    deliveredToAtLeastOne?: boolean;
    reactionSummary?: Array<{
      emoji: string;
      count: number;
      reactedByMe: boolean;
    }>;
  }) => void;
  "group:message_new": (payload: {
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
    decryptError?: boolean;
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
      decryptError?: boolean;
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
    readCount?: number;
    deliveredToAtLeastOne?: boolean;
    reactionSummary?: Array<{
      emoji: string;
      count: number;
      reactedByMe: boolean;
    }>;
  }) => void;
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
  message_deleted: (payload: {
    chatId: string;
    messageIds: string[];
    deletedById: string;
    deletedAt: string;
  }) => void;
  message_reaction_updated: (payload: {
    messageId: string;
    chatType: "DM" | "GROUP" | "AI";
    chatId: string;
    groupId?: string | null;
    summary: Array<{ emoji: string; count: number }>;
    actorUserId: string;
    emoji: string;
    action: "ADDED" | "REMOVED";
  }) => void;
  message_status_update: (payload: {
    chatId: string;
    messageId: string;
    status: "SENT" | "DELIVERED" | "READ";
  }) => void;
  message_read: (payload: { chatId: string; readerId: string }) => void;
  "group:message_delivered": (payload: {
    messageId: string;
    deliveredToAtLeastOne: boolean;
  }) => void;
  "group:message_read": (payload: {
    chatId: string;
    groupId: string;
    messageId: string;
    userId: string;
    readAt: string;
    readCount: number;
  }) => void;
  unread_update: (payload: {
    chatId: string;
    unreadCount: number;
    totalUnread: number;
    directUnread: number;
    groupUnread: number;
    aiUnread: number;
    unreadCountDelta: number;
    totalUnreadDelta: number;
  }) => void;
  unread_reset: (payload: { chatId: string; unreadCount: number }) => void;
  ai_turn_created: (payload: {
    threadId: string;
    turn: {
      id: string;
      threadId: string;
      role: "USER" | "AI";
      content: string;
      meta?: Record<string, unknown> | null;
      createdAt: string;
    };
  }) => void;
  ai_turn_updated: (payload: {
    threadId: string;
    turn: {
      id: string;
      threadId: string;
      role: "USER" | "AI";
      content: string;
      meta?: Record<string, unknown> | null;
      createdAt: string;
    };
  }) => void;
  ai_thread_updated: (payload: { threadId: string; updatedAt: string }) => void;
  typing: (payload: { chatId: string; userId: string }) => void;
  stop_typing: (payload: { chatId: string; userId: string }) => void;
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
  "call:declined": (payload: { callId: string; declinedBy: string; state: string }) => void;
  "call:ended": (payload: { callId: string; state: string; endedAt: string }) => void;
  "call:missed": (payload: { callId: string; state: string }) => void;
  "call:busy": (payload: { callId: string; userId: string }) => void;
  "call:failed": (payload: { callId: string; reason: string }) => void;
  "call:error": (payload: { code: string; message: string; callId?: string }) => void;
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
  socket_error: (payload: { code: string; message: string }) => void;
};

type ClientToServerEvents = {
  join_chat: (payload: { chatId: string }) => void;
  typing: (payload: { chatId: string }) => void;
  stop_typing: (payload: { chatId: string }) => void;
  message_delivered: (payload: { chatId: string; messageId: string }) => void;
  mark_read: (payload: { chatId: string }) => void;
  "call:start": (payload: {
    type: "VOICE" | "VIDEO";
    peerUserId?: string;
    chatId?: string;
    isGroup?: boolean;
  }) => void;
  "call:cancel": (payload: { callId: string }) => void;
  "call:accept": (payload: { callId: string }) => void;
  "call:decline": (payload: { callId: string }) => void;
  "call:end": (payload: { callId: string }) => void;
  "webrtc:offer": (payload: {
    callId: string;
    toUserId: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    meta?: Record<string, unknown>;
  }) => void;
  "webrtc:answer": (payload: {
    callId: string;
    toUserId: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    meta?: Record<string, unknown>;
  }) => void;
  "webrtc:ice": (payload: {
    callId: string;
    toUserId: string;
    candidate?: RTCIceCandidateInit;
    meta?: Record<string, unknown>;
  }) => void;
  "webrtc:renegotiate": (payload: {
    callId: string;
    toUserId: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    meta?: Record<string, unknown>;
  }) => void;
  "call:heartbeat": (payload: { callId: string; ts?: number }) => void;
};

let socket:
  | Socket<ServerToClientEvents, ClientToServerEvents>
  | null = null;
let activeToken: string | null = null;

export const connectSocket = () => {
  const token = getAuthToken();
  if (!token) return null;

  if (!socket) {
    socket = io(getApiBaseUrl(), {
      autoConnect: false,
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: { token },
    });
    activeToken = token;
  } else {
    const tokenChanged = activeToken !== token;
    socket.auth = { token };

    if (tokenChanged && socket.connected) {
      socket.disconnect();
    }
    activeToken = token;
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

export const disconnectSocket = () => {
  if (!socket) return;
  socket.disconnect();
  activeToken = null;
};

export const getSocket = () => socket;
