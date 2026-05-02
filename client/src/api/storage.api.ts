import { api } from "./api";
import type { ApiEnvelope, StorageUsageRecord } from "./types";

export const fetchStorageUsage = async () => {
  const response = await api.get<ApiEnvelope<StorageUsageRecord>>("/storage/usage");
  return response.data.data;
};

