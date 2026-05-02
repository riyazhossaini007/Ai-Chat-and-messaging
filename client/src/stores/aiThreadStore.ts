import { create } from "zustand";
import { withDevtools } from "./storeUtils";
import {
  createAiThread,
  createAiThreadTurn,
  getAiThread,
  type AiThreadRecord,
  type AiTurnRecord,
} from "../api/ai.api";

type AiThreadState = {
  aiPanelOpen: boolean;
  activeChatId?: string;
  activeThreadId?: string;
  targetMessageId?: string;
  threadsById: Record<string, AiThreadRecord>;
  turnsByThreadId: Record<string, AiTurnRecord[]>;
  openPanel: (input: { chatId: string; targetMessageId?: string }) => Promise<void>;
  closePanel: () => void;
  setActiveThread: (threadId?: string) => void;
  ensureThread: (chatId: string, targetMessageId?: string) => Promise<string>;
  loadThread: (threadId: string) => Promise<void>;
  sendTurn: (prompt: string, commandHint?: "SUMMARIZE" | "EXPLAIN" | "TRANSLATE" | "GENERAL", translateTo?: string) => Promise<void>;
  applyTurnCreated: (threadId: string, turn: AiTurnRecord) => void;
  applyTurnUpdated: (threadId: string, turn: AiTurnRecord) => void;
  clearForChatSwitch: (nextChatId: string) => void;
};

const upsertTurn = (list: AiTurnRecord[], turn: AiTurnRecord) => {
  const idx = list.findIndex((item) => item.id === turn.id);
  if (idx === -1) return [...list, turn].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const next = [...list];
  next[idx] = turn;
  return next;
};

export const useAiThreadStore = create<AiThreadState>()(
  withDevtools(
    (set, get) => ({
      aiPanelOpen: false,
      activeChatId: undefined,
      activeThreadId: undefined,
      targetMessageId: undefined,
      threadsById: {},
      turnsByThreadId: {},

      openPanel: async ({ chatId, targetMessageId }) => {
        const threadId = await get().ensureThread(chatId, targetMessageId);
        set({
          aiPanelOpen: true,
          activeChatId: chatId,
          targetMessageId,
          activeThreadId: threadId,
        });
      },

      closePanel: () => {
        set({ aiPanelOpen: false });
      },

      setActiveThread: (threadId) => set({ activeThreadId: threadId }),

      ensureThread: async (chatId, targetMessageId) => {
        const payload = await createAiThread({
          chatId,
          targetMessageId,
        });
        const thread = payload.thread as AiThreadRecord;
        set((state) => ({
          threadsById: {
            ...state.threadsById,
            [thread.id]: thread,
          },
          turnsByThreadId: {
            ...state.turnsByThreadId,
            [thread.id]: payload.turns ?? [],
          },
          activeThreadId: thread.id,
          activeChatId: chatId,
          targetMessageId,
        }));
        return thread.id;
      },

      loadThread: async (threadId) => {
        const payload = await getAiThread(threadId);
        set((state) => ({
          threadsById: {
            ...state.threadsById,
            [payload.thread.id]: payload.thread,
          },
          turnsByThreadId: {
            ...state.turnsByThreadId,
            [payload.thread.id]: payload.turns,
          },
          activeThreadId: payload.thread.id,
          activeChatId: payload.thread.chatId,
          targetMessageId: payload.thread.targetMessageId ?? undefined,
        }));
      },

      sendTurn: async (prompt, commandHint, translateTo) => {
        const threadId = get().activeThreadId;
        if (!threadId) throw new Error("No active AI thread");
        const data = await createAiThreadTurn(threadId, {
          prompt,
          commandHint,
          translateTo,
        });
        set((state) => ({
          turnsByThreadId: {
            ...state.turnsByThreadId,
            [threadId]: upsertTurn(
              upsertTurn(state.turnsByThreadId[threadId] ?? [], data.userTurn),
              data.aiTurnPlaceholder
            ),
          },
        }));
      },

      applyTurnCreated: (threadId, turn) =>
        set((state) => ({
          turnsByThreadId: {
            ...state.turnsByThreadId,
            [threadId]: upsertTurn(state.turnsByThreadId[threadId] ?? [], turn),
          },
        })),

      applyTurnUpdated: (threadId, turn) =>
        set((state) => ({
          turnsByThreadId: {
            ...state.turnsByThreadId,
            [threadId]: upsertTurn(state.turnsByThreadId[threadId] ?? [], turn),
          },
        })),

      clearForChatSwitch: (nextChatId) =>
        set((state) => {
          if (state.activeChatId === nextChatId) return state;
          return {
            aiPanelOpen: false,
            activeChatId: nextChatId,
            activeThreadId: undefined,
            targetMessageId: undefined,
          };
        }),
    }),
    "aiThreadStore"
  )
);

