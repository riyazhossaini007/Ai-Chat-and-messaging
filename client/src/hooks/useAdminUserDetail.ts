import { fetchAdminUserDetail } from "../api/admin";
import { useAdminAsync } from "./useAdminAsync";

// Example: const user = useAdminUserDetail(userId)
export const useAdminUserDetail = (id?: string) =>
  useAdminAsync<Awaited<ReturnType<typeof fetchAdminUserDetail>> | null>(
    () => (id ? fetchAdminUserDetail(id) : Promise.resolve(null)),
    [id]
  );
