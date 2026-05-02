import { create } from "zustand";
import { withDevtools } from "./storeUtils";

interface ChatContextStore {
  selectedChatId: string | null;
  selectedGroupId: string | null;
  selectedAiSessionId: string | null;
  selectChat: (chatId: string) => void;
  selectGroup: (groupId: string) => void;
  selectAiSession: (sessionId: string) => void;
  clearSelection: () => void;
}

export const useChatContextStore = create<ChatContextStore>()(
  withDevtools(
    (set) => ({
      selectedChatId: null,
      selectedGroupId: null,
      selectedAiSessionId: null,
      selectChat: (chatId) =>
        set({
          selectedChatId: chatId,
          selectedGroupId: null,
          selectedAiSessionId: null,
        }),
      selectGroup: (groupId) =>
        set({
          selectedChatId: null,
          selectedGroupId: groupId,
          selectedAiSessionId: null,
        }),
      selectAiSession: (sessionId) =>
        set({
          selectedChatId: null,
          selectedGroupId: null,
          selectedAiSessionId: sessionId,
        }),
      clearSelection: () =>
        set({
          selectedChatId: null,
          selectedGroupId: null,
          selectedAiSessionId: null,
        }),
    }),
    "chatContextStore"
  )
);
