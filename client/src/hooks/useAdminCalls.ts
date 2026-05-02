import { fetchAdminCallDetail, fetchAdminCallStats, fetchAdminCalls } from "../api/admin";
import { useAdminAsync } from "./useAdminAsync";

// Example: const calls = useAdminCalls({ from, to, status })
export const useAdminCalls = (filters: Record<string, unknown>) =>
  useAdminAsync(() => fetchAdminCalls(filters), [JSON.stringify(filters)]);

export const useAdminCallDetail = (id?: string) =>
  useAdminAsync<Awaited<ReturnType<typeof fetchAdminCallDetail>> | null>(
    () => (id ? fetchAdminCallDetail(id) : Promise.resolve(null)),
    [id]
  );

export const useAdminCallStats = (from?: string, to?: string) =>
  useAdminAsync(() => fetchAdminCallStats(from, to), [from, to]);
