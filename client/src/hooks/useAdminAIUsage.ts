import { fetchAdminAiTopUsers, fetchAdminAiUsage } from "../api/admin";
import { useAdminAsync } from "./useAdminAsync";

// Example: const usage = useAdminAIUsage({ from, to, provider })
export const useAdminAIUsage = (filters: Record<string, unknown>) =>
  useAdminAsync(() => fetchAdminAiUsage(filters), [JSON.stringify(filters)]);

export const useAdminAITopUsers = (params: Record<string, unknown>) =>
  useAdminAsync(() => fetchAdminAiTopUsers(params), [JSON.stringify(params)]);

