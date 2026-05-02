import { deleteAdminGroup, fetchAdminGroupDetail, fetchAdminGroups, freezeAdminGroup } from "../api/admin";
import { useAdminAsync, useAdminMutation } from "./useAdminAsync";

// Example: const groups = useAdminGroups({ q, status })
export const useAdminGroups = (filters: Record<string, unknown>) =>
  useAdminAsync(() => fetchAdminGroups(filters), [JSON.stringify(filters)]);

export const useAdminGroupDetail = (id?: string) =>
  useAdminAsync<Awaited<ReturnType<typeof fetchAdminGroupDetail>> | null>(
    () => (id ? fetchAdminGroupDetail(id) : Promise.resolve(null)),
    [id]
  );

export const useFreezeGroup = () => useAdminMutation(freezeAdminGroup);
export const useDeleteGroup = () => useAdminMutation(deleteAdminGroup);
