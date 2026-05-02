import { api } from "./api";
import type { ApiEnvelope } from "./types";
import type {
  AdminAiUsageResponse,
  AdminAuditLog,
  AdminCall,
  AdminGroup,
  AdminOverviewStats,
  AdminReport,
  AdminUserDetail,
  AdminUsersResponse,
  EntitlementFeatureKey,
  EntitlementGrantRecord,
  ReportStatus,
} from "../types/admin";

const qs = (params: Record<string, unknown>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");

export const fetchAdminOverviewStats = async (from?: string, to?: string) => {
  const query = qs({ from, to });
  const res = await api.get<ApiEnvelope<AdminOverviewStats>>(`/admin/stats/overview${query ? `?${query}` : ""}`);
  return res.data.data;
};

export const fetchAdminUsers = async (filters: Record<string, unknown>) => {
  const res = await api.get<ApiEnvelope<AdminUsersResponse>>(`/admin/users?${qs(filters)}`);
  return res.data.data;
};

export const fetchAdminUserDetail = async (id: string) => {
  const res = await api.get<ApiEnvelope<{ user: AdminUserDetail }>>(`/admin/users/${encodeURIComponent(id)}`);
  return res.data.data.user;
};

export const patchAdminUserRole = async (id: string, role: "USER" | "MODERATOR" | "ADMIN" | "SUPERADMIN") => {
  const res = await api.patch<ApiEnvelope<{ id: string; role: string }>>(`/admin/users/${encodeURIComponent(id)}/role`, { role });
  return res.data.data;
};

export const patchAdminUserStatus = async (id: string, payload: { status: "ACTIVE" | "BANNED" | "DELETED"; reason?: string }) => {
  const res = await api.patch<ApiEnvelope<{ id: string; status: string }>>(`/admin/users/${encodeURIComponent(id)}/status`, payload);
  return res.data.data;
};

export const patchAdminUserNote = async (id: string, note: string | null) => {
  const res = await api.patch<ApiEnvelope<{ id: string; adminNote: string | null }>>(`/admin/users/${encodeURIComponent(id)}/note`, { note });
  return res.data.data;
};

export const fetchAdminEntitlements = async (userId: string) => {
  const res = await api.get<ApiEnvelope<{ items: EntitlementGrantRecord[] }>>(`/admin/entitlements?${qs({ userId })}`);
  return res.data.data.items;
};

export const grantEntitlement = async (payload: {
  userId: string;
  featureKey: EntitlementFeatureKey;
  expiresAt?: string;
  reason?: string;
}) => {
  const res = await api.post<ApiEnvelope<{ entitlement: EntitlementGrantRecord }>>("/admin/entitlements/grant", payload);
  return res.data.data.entitlement;
};

export const revokeEntitlement = async (payload: { entitlementId: string; reason?: string }) => {
  const res = await api.post<ApiEnvelope<{ entitlement: EntitlementGrantRecord }>>("/admin/entitlements/revoke", payload);
  return res.data.data.entitlement;
};

export const fetchAdminAiUsage = async (filters: Record<string, unknown>) => {
  const res = await api.get<ApiEnvelope<AdminAiUsageResponse>>(`/admin/ai/usage?${qs(filters)}`);
  return res.data.data;
};

export const fetchAdminAiTopUsers = async (params: Record<string, unknown>) => {
  const res = await api.get<ApiEnvelope<{ items: AdminAiUsageResponse["topUsers"] }>>(`/admin/ai/users/top?${qs(params)}`);
  return res.data.data.items;
};

export const fetchAdminReports = async (filters: Record<string, unknown>) => {
  const res = await api.get<ApiEnvelope<{ items: AdminReport[] }>>(`/admin/reports?${qs(filters)}`);
  return res.data.data.items;
};

export const fetchAdminReportDetail = async (id: string) => {
  const res = await api.get<ApiEnvelope<{ report: AdminReport }>>(`/admin/reports/${encodeURIComponent(id)}`);
  return res.data.data.report;
};

export const resolveAdminReport = async (id: string, status: ReportStatus, resolutionNote?: string) => {
  const res = await api.patch<ApiEnvelope<{ report: AdminReport }>>(`/admin/reports/${encodeURIComponent(id)}/status`, { status, resolutionNote });
  return res.data.data.report;
};

export const banUserModeration = async (userId: string, reason: string) => {
  const res = await api.post<ApiEnvelope<{ user: unknown }>>("/admin/moderation/ban-user", { userId, reason });
  return res.data.data.user;
};

export const removeMessageModeration = async (messageId: string, reason: string) => {
  const res = await api.post<ApiEnvelope<{ message: unknown }>>("/admin/moderation/remove-message", { messageId, reason });
  return res.data.data.message;
};

export const fetchAdminGroups = async (filters: Record<string, unknown>) => {
  const res = await api.get<ApiEnvelope<{ items: AdminGroup[] }>>(`/admin/groups?${qs(filters)}`);
  return res.data.data.items;
};

export const fetchAdminGroupDetail = async (id: string) => {
  const res = await api.get<ApiEnvelope<{ group: unknown }>>(`/admin/groups/${encodeURIComponent(id)}`);
  return res.data.data.group;
};

export const freezeAdminGroup = async (id: string, freeze: boolean, reason?: string) => {
  const res = await api.patch<ApiEnvelope<{ group: { id: string; status: string } }>>(`/admin/groups/${encodeURIComponent(id)}/freeze`, { freeze, reason });
  return res.data.data.group;
};

export const deleteAdminGroup = async (id: string) => {
  const res = await api.delete<ApiEnvelope<{ group: { id: string; status: string } }>>(`/admin/groups/${encodeURIComponent(id)}`);
  return res.data.data.group;
};

export const fetchAdminCalls = async (filters: Record<string, unknown>) => {
  const res = await api.get<ApiEnvelope<{ items: AdminCall[] }>>(`/admin/calls?${qs(filters)}`);
  return res.data.data.items;
};

export const fetchAdminCallDetail = async (id: string) => {
  const res = await api.get<ApiEnvelope<{ call: unknown }>>(`/admin/calls/${encodeURIComponent(id)}`);
  return res.data.data.call;
};

export const fetchAdminCallStats = async (from?: string, to?: string) => {
  const res = await api.get<ApiEnvelope<Record<string, unknown>>>(`/admin/calls/stats?${qs({ from, to })}`);
  return res.data.data;
};

export const fetchAdminHealth = async () => {
  const res = await api.get<ApiEnvelope<{ db: string; redis: string; livekit: string }>>("/admin/health");
  return res.data.data;
};

export const fetchAdminAuditLogs = async (filters: Record<string, unknown>) => {
  const res = await api.get<ApiEnvelope<{ items: AdminAuditLog[] }>>(`/admin/audit-logs?${qs(filters)}`);
  return res.data.data.items;
};
