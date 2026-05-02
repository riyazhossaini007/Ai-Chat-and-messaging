import { fetchAdminUsers, patchAdminUserNote, patchAdminUserRole, patchAdminUserStatus } from "../api/admin";
import { useAdminAsync, useAdminMutation } from "./useAdminAsync";

// Example: const users = useAdminUsers({ q, role, status, limit: 20 })
export const useAdminUsers = (filters: Record<string, unknown>) =>
  useAdminAsync(() => fetchAdminUsers(filters), [JSON.stringify(filters)]);

export const usePatchAdminUserRole = () => useAdminMutation(patchAdminUserRole);
export const usePatchAdminUserStatus = () => useAdminMutation(patchAdminUserStatus);
export const usePatchAdminUserNote = () => useAdminMutation(patchAdminUserNote);

