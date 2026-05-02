export type AdminOverviewStats = {
  range: { from: string; to: string };
  users: { totalUsers: number; newUsers: number; newUsersByDay: Array<{ day: string; count: number }> };
  activity: { dau: number; wau: number; messagesSent: number; messagesByDay: Array<{ day: string; count: number }> };
  ai: {
    aiRequests: number;
    aiUsers: number;
    aiByDay: Array<{ day: string; count: number }>;
    modelBreakdown: Record<string, number>;
    tokensIn: number;
    tokensOut: number;
    estimatedCostUsd: number;
  };
  calls: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    droppedCalls: number;
    avgDurationSec: number;
    successRate: number;
    callsByDay: Array<{ day: string; count: number }>;
    failureReasons: Array<{ reason: string; count: number }>;
  };
  billing: { paidUsers: number; complimentaryUsers: number; trialUsers: number };
  moderation: { reportsOpen: number; reportsResolved: number; bansActive: number };
};

export type AdminUserListItem = {
  id: string;
  username: string;
  name: string | null;
  phone: string;
  avatar: string | null;
  role: "USER" | "MODERATOR" | "ADMIN" | "SUPERADMIN";
  status: "ACTIVE" | "BANNED" | "DELETED";
  createdAt: string;
  lastActiveAt: string | null;
  plan: string;
  proUntil: string | null;
};

export type AdminUsersResponse = {
  items: AdminUserListItem[];
  nextCursor: string | null;
};

export type AdminUserDetail = AdminUserListItem & {
  isVerified: boolean;
  updatedAt: string;
  adminNote: string | null;
  entitlements: EntitlementGrantRecord[];
  usageSummary7d: { messagesSent: number; aiRequests: number; calls: number };
};

export type EntitlementFeatureKey = "PRO_ACCESS" | "AI_UNLIMITED" | "CALLING" | "GROUP_CALLING" | "NO_ADS";
export type EntitlementGrantRecord = {
  id: string;
  userId: string;
  featureKey: EntitlementFeatureKey;
  expiresAt: string | null;
  isRevoked: boolean;
  grantedByUserId: string;
  reason: string | null;
  createdAt: string;
  revokedAt: string | null;
  revokedByUserId: string | null;
};

export type AdminAiUsageResponse = {
  totals: { requests: number; aiUsers: number; tokensIn: number; tokensOut: number; totalCostUsd: number };
  trendByDay: Array<{ day: string; count: number }>;
  topUsers: Array<{ userId: string; username: string | null; name: string | null; requests: number; tokens: number }>;
};

export type ReportStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
export type ReportTargetType = "USER" | "MESSAGE" | "GROUP" | "CALL";
export type AdminReport = {
  id: string;
  reporterUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  reasonCode: string;
  description: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  resolutionNote: string | null;
};

export type AdminGroup = {
  id: string;
  title: string;
  name: string;
  status: "ACTIVE" | "FROZEN" | "DELETED";
  createdAt: string;
  memberCount: number;
  messageCount: number;
  chatId: string;
  creatorId: string;
};

export type AdminCall = {
  id: string;
  type: string;
  isGroup: boolean;
  chatId: string | null;
  createdBy: string;
  hostUserId: string;
  status: string;
  startedAt: string | null;
  connectedAt?: string | null;
  endedAt: string | null;
  durationSec?: number;
  failureReason?: string | null;
  sfuProvider?: string;
  createdAt: string;
  updatedAt: string;
  participantsCount?: number;
};

export type AdminAuditLog = {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  actor?: {
    id: string;
    username: string;
    name: string | null;
  };
};
