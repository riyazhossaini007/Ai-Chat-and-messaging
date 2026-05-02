export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type UnreadSummary = {
  total: number;
  direct: number;
  group: number;
  ai: number;
};

export type AuthUser = {
  id: string;
  username: string;
  name: string | null;
  phone: string;
  avatar: string | null;
  role: "USER" | "MODERATOR" | "ADMIN" | "SUPERADMIN";
  status: "ACTIVE" | "BANNED" | "DELETED";
  isVerified: boolean;
  plan: "FREE" | "PAID";
  subscriptionActive: boolean;
  credits: {
    totalCredits: number;
    usedCredits: number;
    remainingCredits: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type NearbyUserRecord = {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
};

export type ChatParticipant = {
  userId: string;
  user: {
    id: string;
    username: string;
    name: string;
    avatar: string | null;
  };
};

export type GroupRole = "CREATOR" | "ADMIN" | "MEMBER";

export type ChatMessagePreview = {
  id: string;
  content: string | null;
  decryptError?: boolean;
  mediaUrl: string | null;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  deletedForEveryone: boolean;
  deletedAt: string | null;
  deletedById: string | null;
  chatId: string;
  senderId: string | null;
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
  status: "SENT" | "DELIVERED" | "READ";
  replyToId: string | null;
  isForwarded: boolean;
  forwardFromMessageId: string | null;
  forwardFromSenderId: string | null;
  createdAt: string;
  readCount?: number;
  deliveredToAtLeastOne?: boolean;
  sender: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
  } | null;
};

export type ViewerChatParticipant = {
  chatId: string;
  userId?: string;
  lastReadAt?: string;
  pinned: boolean;
  pinnedAt: string | null;
  archived: boolean;
  archivedAt: string | null;
  customOrder: number | null;
};

export type GroupInfo = {
  id: string;
  title: string;
  name: string;
  avatar: string | null;
  description?: string | null;
  rulesText?: string | null;
  chatId: string;
  creatorId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatRecord = {
  id: string;
  type: "DIRECT" | "GROUP" | "AI";
  createdAt: string;
  lastMessageAt: string;
  unreadCount: number;
  participants: ChatParticipant[];
  messages: ChatMessagePreview[];
  group: GroupInfo | null;
  viewerParticipant: ViewerChatParticipant | null;
};

export type MessageRecord = {
  id: string;
  content: string | null;
  decryptError?: boolean;
  mediaUrl: string | null;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  deletedForEveryone: boolean;
  deletedAt: string | null;
  deletedById: string | null;
  chatId: string;
  senderId: string | null;
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
  sender: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
  } | null;
  status: "SENT" | "DELIVERED" | "READ";
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
  readCount?: number;
  deliveredToAtLeastOne?: boolean;
  reactionSummary?: Array<{
    emoji: string;
    count: number;
    reactedByMe: boolean;
  }>;
  meta?: Record<string, unknown> | null;
};

export type MessageReactionDetailsRecord = {
  emoji: string;
  count: number;
  users: Array<{
    id: string;
    username: string;
    avatar: string | null;
    createdAt: string;
  }>;
};

export type MediaMessageRecord = {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  deletedForEveryone: boolean;
  deletedAt: string | null;
  deletedById: string | null;
  chatId: string;
  senderId: string | null;
  sender: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
  };
  status: "SENT" | "DELIVERED" | "READ";
  replyToId: string | null;
  isForwarded: boolean;
  forwardFromMessageId: string | null;
  forwardFromSenderId: string | null;
  createdAt: string;
};

export type UserSettingsRecord = {
  id: string;
  userId: string;
  language: "en";
  timeZone:
    | "America/New_York"
    | "America/Chicago"
    | "America/Denver"
    | "America/Los_Angeles"
    | "Asia/Kolkata";
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  autoStart: boolean;
  allowMessagesFromNonContacts: boolean;
  lastSeen: "everyone" | "contacts" | "nobody";
  profilePhoto: "everyone" | "contacts" | "nobody";
  readReceipts: boolean;
  twoFactor: {
    state: "OFF" | "SETUP_REQUIRED" | "ON";
  };
  chat: {
    enterToSend: boolean;
    autoDownload: boolean;
    mediaQuality: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type StorageUsageRecord = {
  totalMb: number;
  breakdown: {
    imagesMb: number;
    videosMb: number;
    audioMb: number;
    documentsMb: number;
  };
};

export type BlockedUserRecord = {
  userId: string;
  username: string;
  avatar: string | null;
  blockedAt: string;
};

export type GroupSummaryRecord = {
  id: string;
  title: string;
  avatar: string | null;
  memberCount: number;
  myRole: GroupRole;
  chatId: string;
  description: string | null;
  rulesText: string | null;
  lastMessagePreview: string;
  unseenCount: number;
  updatedAt: string;
};

export type GroupMemberRecord = {
  id: string;
  userId: string;
  groupId: string;
  role: GroupRole;
  joinedAt: string;
  user: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
  };
};

export type GroupInviteRecord = {
  id: string;
  groupId: string;
  token: string;
  createdById: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type GroupDetailsRecord = GroupInfo & {
  myRole: GroupRole;
  memberCount: number;
  members: GroupMemberRecord[];
  invite: GroupInviteRecord | null;
};

export type KnowledgeItemRecord = {
  id: string;
  type:
    | "SUMMARY"
    | "TASK"
    | "DECISION"
    | "IDEA"
    | "FACT"
    | "FOLLOW_UP"
    | "MEETING_NOTE"
    | "ISSUE"
    | "RISK"
    | "MILESTONE";
  title: string;
  shortSummary: string;
  normalizedContent: string;
  sourceConversationId: string | null;
  sourceGroupId: string | null;
  authorUserId: string | null;
  createdByUserId: string | null;
  confidenceScore: number;
  visibilityScope: "PRIVATE" | "CHAT" | "GROUP";
  reviewState: "PENDING" | "CONFIRMED" | "DISMISSED";
  tags: string[];
  createdAt: string;
  updatedAt: string;
  sourceLinks?: Array<{
    id: string;
    messageId: string | null;
    fileId: string | null;
    chatId: string | null;
    groupId: string | null;
    excerpt: string | null;
  }>;
};

export type UserMemoryRecord = {
  id: string;
  title: string;
  shortSummary: string;
  normalizedContent: string;
  privacyScope: "PRIVATE" | "SHARED_GROUP";
  tags: string[];
  topicKey: string | null;
  sourceConversationId: string | null;
  sourceGroupId: string | null;
  pinnedAt: string | null;
  archivedAt: string | null;
  forgottenAt: string | null;
  createdAt: string;
  updatedAt: string;
  relevanceScore?: number;
};

export type GroupInsightRecord = {
  id: string;
  groupId: string;
  type: "WEEKLY_SUMMARY" | "DECISION" | "TASK" | "BLOCKER" | "TOPIC" | "KEY_FILE" | "CHANGELOG";
  title: string;
  shortSummary: string;
  normalizedContent: string;
  status: "ACTIVE" | "RESOLVED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
};

export type AiResponseSourceRecord = {
  sourceType: "MESSAGE" | "FILE" | "KNOWLEDGE" | "MEMORY" | "GROUP_INSIGHT";
  sourceId: string;
  title: string;
  snippet: string;
  relevanceScore: number;
  meta: Record<string, unknown>;
};

export type ContextRespondResult = {
  contextSessionId: string;
  reply: {
    text: string;
    mode:
      | "SUMMARIZE"
      | "ANSWER_QUESTION"
      | "EXTRACT_TASKS"
      | "EXPLAIN"
      | "SEARCH_MEMORY"
      | "PROJECT_UPDATE";
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
  sourcesUsed: AiResponseSourceRecord[];
};

export type SemanticSearchResultGroup = {
  type: string;
  items: Array<{
    id: string;
    title: string;
    snippet: string;
    resultType: string;
    sourceLocation: Record<string, unknown>;
    date: string;
    relevanceScore: number;
  }>;
};
