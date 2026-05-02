import { fetchAdminEntitlements, grantEntitlement, revokeEntitlement } from "../api/admin";
import { useAdminAsync, useAdminMutation } from "./useAdminAsync";

// Example: const entitlements = useAdminEntitlements(userId)
export const useAdminEntitlements = (userId?: string) =>
  useAdminAsync(() => (userId ? fetchAdminEntitlements(userId) : Promise.resolve([])), [userId]);

export const useGrantEntitlement = () => useAdminMutation(grantEntitlement);
export const useRevokeEntitlement = () => useAdminMutation(revokeEntitlement);

