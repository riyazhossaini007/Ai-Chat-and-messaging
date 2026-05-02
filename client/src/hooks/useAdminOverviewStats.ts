import { fetchAdminOverviewStats } from "../api/admin";
import { useAdminAsync } from "./useAdminAsync";

// Example: const { data } = useAdminOverviewStats(fromIso, toIso)
export const useAdminOverviewStats = (from?: string, to?: string) =>
  useAdminAsync(() => fetchAdminOverviewStats(from, to), [from, to]);

