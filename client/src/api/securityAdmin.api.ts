import { api } from "./api";
import type { ApiEnvelope } from "./types";

export type SecurityUserRoleRow = {
  id: string;
  username: string;
  name: string | null;
  phone: string;
  createdAt: string;
  roles: Array<"USER" | "MODERATOR" | "ADMIN" | "SUPERADMIN">;
};

export type RoleAuditRow = {
  id: string;
  actorUserId: string;
  targetUserId: string | null;
  action: string;
  reason: string | null;
  createdAt: string;
  before: unknown;
  after: unknown;
};

export const startAdminStepUp = async (payload: { password: string; reason: string }) => {
  const response = await api.post<
    ApiEnvelope<{
      challengeId: string;
      expiresAt: string;
    }>
  >("/auth/admin/step-up/start", payload);
  return response.data.data;
};

export const verifyAdminStepUp = async (payload: { challengeId: string; otp: string }) => {
  const response = await api.post<
    ApiEnvelope<{
      stepUpToken: string;
      expiresAt: string;
    }>
  >("/auth/admin/step-up/verify", payload);
  return response.data.data;
};

export const fetchRoleUsers = async (query = "", limit = 100) => {
  const response = await api.get<ApiEnvelope<{ users: SecurityUserRoleRow[] }>>(
    `/security/admin/roles/users?query=${encodeURIComponent(query)}&limit=${encodeURIComponent(
      String(limit)
    )}`
  );
  return response.data.data.users;
};

export const fetchRoleAuditLogs = async (limit = 100) => {
  const response = await api.get<ApiEnvelope<{ logs: RoleAuditRow[] }>>(
    `/security/admin/roles/audit?limit=${encodeURIComponent(String(limit))}`
  );
  return response.data.data.logs;
};

export const assignUserRole = async (payload: {
  userId: string;
  role: "USER" | "MODERATOR" | "ADMIN" | "SUPERADMIN";
  reason: string;
  requestId: string;
  stepUpToken: string;
}) => {
  return api.post("/security/admin/roles/assign", payload, {
    headers: { "x-admin-stepup-token": payload.stepUpToken },
  });
};

export const revokeUserRole = async (payload: {
  userId: string;
  role: "USER" | "MODERATOR" | "ADMIN" | "SUPERADMIN";
  reason: string;
  requestId: string;
  stepUpToken: string;
}) => {
  return api.post("/security/admin/roles/revoke", payload, {
    headers: { "x-admin-stepup-token": payload.stepUpToken },
  });
};
