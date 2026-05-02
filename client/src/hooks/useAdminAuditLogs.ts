import { fetchAdminAuditLogs } from "../api/admin";
import { useAdminAsync } from "./useAdminAsync";

// Example: const audits = useAdminAuditLogs({ limit: 100 })
export const useAdminAuditLogs = (filters: Record<string, unknown>) =>
  useAdminAsync(() => fetchAdminAuditLogs(filters), [JSON.stringify(filters)]);

