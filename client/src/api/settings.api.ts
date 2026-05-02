import { api } from "./api";
import type { ApiEnvelope, UserSettingsRecord } from "./types";

export type SettingsPatchPayload = {
  language?: UserSettingsRecord["language"];
  timeZone?: UserSettingsRecord["timeZone"];
  dateFormat?: UserSettingsRecord["dateFormat"];
  autoStart?: boolean;
  allowMessagesFromNonContacts?: boolean;
  lastSeen?: UserSettingsRecord["lastSeen"];
  profilePhoto?: UserSettingsRecord["profilePhoto"];
  readReceipts?: boolean;
  twoFactorEnabled?: boolean;
  chat?: {
    enterToSend?: boolean;
    autoDownload?: boolean;
    mediaQuality?: number;
  };
};

export type AvatarRequestPayload = {
  name: string;
  useCase: string;
  tone: string;
};

export const fetchSettings = async () => {
  const response = await api.get<ApiEnvelope<{ settings: UserSettingsRecord }>>(
    "/settings"
  );
  return response.data.data.settings;
};

export const patchSettings = async (payload: SettingsPatchPayload) => {
  const response = await api.patch<ApiEnvelope<{ settings: UserSettingsRecord }>>(
    "/settings",
    payload
  );
  return response.data.data.settings;
};

export const createAvatarRequest = async (payload: AvatarRequestPayload) => {
  const response = await api.post<ApiEnvelope<{ jobId: string }>>(
    "/settings/avatar-requests",
    payload
  );
  return response.data.data;
};
