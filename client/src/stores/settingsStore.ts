import { create } from "zustand";
import { blockUser as blockUserApi, fetchBlockedUsers, unblockUser as unblockUserApi } from "../api/blocks.api";
import { fetchStorageUsage } from "../api/storage.api";
import {
  fetchSettings,
  patchSettings as patchSettingsApi,
  type SettingsPatchPayload,
} from "../api/settings.api";
import { getApiErrorMessage } from "../api/api";
import type { BlockedUserRecord, StorageUsageRecord, UserSettingsRecord } from "../api/types";
import { withDevtools } from "./storeUtils";

const getSavingFieldKey = (patch: SettingsPatchPayload) => {
  const [firstKey] = Object.keys(patch);
  if (!firstKey) return "unknown";
  if (firstKey !== "chat") return firstKey;
  const chatKeys = Object.keys(patch.chat ?? {});
  const firstChatKey = chatKeys[0];
  return firstChatKey ? `chat.${firstChatKey}` : "chat";
};

type SettingsStore = {
  settings: UserSettingsRecord | null;
  blockedUsers: BlockedUserRecord[];
  storageUsage: StorageUsageRecord | null;
  storageUsageLoading: boolean;
  storageUsageError: string | null;
  isLoading: boolean;
  isSaving: boolean;
  fieldSaving: Record<string, boolean>;
  error: string | null;
  privacyError: string | null;
  loadSettings: () => Promise<void>;
  patchSettings: (patch: SettingsPatchPayload) => Promise<UserSettingsRecord>;
  loadStorageUsage: () => Promise<void>;
  loadBlockedUsers: () => Promise<void>;
  blockUser: (input: { userId?: string; username?: string }) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  updateAllowMessagesFromNonContacts: (value: boolean) => Promise<void>;
  reset: () => void;
};

export const useSettingsStore = create<SettingsStore>()(
  withDevtools(
    (set, get) => ({
      settings: null,
      blockedUsers: [],
      storageUsage: null,
      storageUsageLoading: false,
      storageUsageError: null,
      isLoading: false,
      isSaving: false,
      fieldSaving: {},
      error: null,
      privacyError: null,
      loadSettings: async () => {
        set({ isLoading: true, error: null });
        try {
          const settings = await fetchSettings();
          set({ settings, error: null });
        } catch (error) {
          set({ error: getApiErrorMessage(error) });
        } finally {
          set({ isLoading: false });
        }
      },
      patchSettings: async (patch) => {
        const savingKey = getSavingFieldKey(patch);
        set((state) => ({
          isSaving: true,
          error: null,
          privacyError: null,
          fieldSaving: {
            ...state.fieldSaving,
            [savingKey]: true,
          },
        }));
        try {
          const settings = await patchSettingsApi(patch);
          set({ settings, error: null, privacyError: null });
          return settings;
        } catch (error) {
          const message = getApiErrorMessage(error);
          set({ error: message, privacyError: message });
          throw error;
        } finally {
          set((state) => ({
            isSaving: false,
            fieldSaving: {
              ...state.fieldSaving,
              [savingKey]: false,
            },
          }));
        }
      },
      loadStorageUsage: async () => {
        set({ storageUsageLoading: true, storageUsageError: null });
        try {
          const storageUsage = await fetchStorageUsage();
          set({ storageUsage, storageUsageError: null });
        } catch (error) {
          set({ storageUsageError: getApiErrorMessage(error) });
        } finally {
          set({ storageUsageLoading: false });
        }
      },
      loadBlockedUsers: async () => {
        set({ privacyError: null });
        try {
          const blockedUsers = await fetchBlockedUsers();
          set({ blockedUsers });
        } catch (error) {
          const message = getApiErrorMessage(error);
          set({ error: message, privacyError: message });
          throw error;
        }
      },
      blockUser: async (input) => {
        set({ privacyError: null });
        try {
          await blockUserApi(input);
          const blockedUsers = await fetchBlockedUsers();
          set({ blockedUsers });
        } catch (error) {
          const message = getApiErrorMessage(error);
          set({ error: message, privacyError: message });
          throw error;
        }
      },
      unblockUser: async (userId) => {
        set({ privacyError: null });
        try {
          await unblockUserApi(userId);
          set((state) => ({
            blockedUsers: state.blockedUsers.filter((item) => item.userId !== userId),
          }));
        } catch (error) {
          const message = getApiErrorMessage(error);
          set({ error: message, privacyError: message });
          throw error;
        }
      },
      updateAllowMessagesFromNonContacts: async (value) => {
        await get().patchSettings({
          allowMessagesFromNonContacts: value,
        });
      },
      reset: () =>
        set({
          settings: null,
          blockedUsers: [],
          storageUsage: null,
          storageUsageLoading: false,
          storageUsageError: null,
          isLoading: false,
          isSaving: false,
          fieldSaving: {},
          error: null,
          privacyError: null,
        }),
    }),
    "settingsStore"
  )
);
