import { create } from "zustand";
import { getMe } from "../api/user.api";
import type { AuthUser } from "../api/types";
import { clearAuthSession, getAuthToken, getStoredUser, persistAuthSession } from "../lib/authStorage";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { useChatContextStore } from "./chatContextStore";
import { useChatStore } from "./chatStore";
import { useSettingsStore } from "./settingsStore";
import { withDevtools } from "./storeUtils";

type AuthStore = {
  user: AuthUser | null;
  token: string | null;
  isBootstrapping: boolean;
  hydrateFromStorage: () => void;
  bootstrapMe: () => Promise<void>;
  setSession: (token: string, user: AuthUser) => void;
  updateUser: (user: AuthUser) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthStore>()(
  withDevtools(
    (set, get) => ({
      user: null,
      token: null,
      isBootstrapping: false,
      hydrateFromStorage: () => {
        const token = getAuthToken();
        const user = getStoredUser();
        set({ token, user });
      },
      bootstrapMe: async () => {
        const token = getAuthToken();
        if (!token) {
          useChatStore.getState().reset();
          useSettingsStore.getState().reset();
          useChatContextStore.getState().clearSelection();
          set({ user: null, token: null, isBootstrapping: false });
          return;
        }

        if (get().isBootstrapping) return;

        set({ isBootstrapping: true, token });
        try {
          const user = await getMe();
          persistAuthSession(token, user);
          set({ user, token });
          connectSocket();
        } catch {
          clearAuthSession();
          disconnectSocket();
          useChatStore.getState().reset();
          useSettingsStore.getState().reset();
          useChatContextStore.getState().clearSelection();
          set({ user: null, token: null });
        } finally {
          set({ isBootstrapping: false });
        }
      },
      setSession: (token, user) => {
        persistAuthSession(token, user);
        set({ token, user });
        connectSocket();
      },
      updateUser: (user) => {
        const token = get().token;
        if (token) {
          persistAuthSession(token, user);
        }
        set({ user });
      },
      clearSession: () => {
        disconnectSocket();
        useChatStore.getState().reset();
        useSettingsStore.getState().reset();
        useChatContextStore.getState().clearSelection();
        clearAuthSession();
        set({ user: null, token: null });
      },
    }),
    "authStore"
  )
);
