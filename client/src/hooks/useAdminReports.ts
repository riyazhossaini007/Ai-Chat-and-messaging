import { fetchAdminReports, resolveAdminReport } from "../api/admin";
import { useAdminAsync, useAdminMutation } from "./useAdminAsync";

// Example: const reports = useAdminReports({ status: "OPEN" })
export const useAdminReports = (filters: Record<string, unknown>) =>
  useAdminAsync(() => fetchAdminReports(filters), [JSON.stringify(filters)]);

export const useResolveReport = () => useAdminMutation(resolveAdminReport);

