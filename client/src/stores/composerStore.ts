import { create } from "zustand";
import { withDevtools } from "./storeUtils";

export type ComposerReplyTarget = {
  id: string;
  senderName: string;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  content: string;
  mediaUrl?: string;
};

export type ComposerForwardTarget = {
  id: string;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  content?: string | null;
  mediaUrl?: string | null;
};

type ComposerStore = {
  replyTo: ComposerReplyTarget | null;
  forwardMessages: ComposerForwardTarget[];
  setReplyTo: (replyTo: ComposerReplyTarget | null) => void;
  setForwardMessages: (messages: ComposerForwardTarget[]) => void;
  clearForwardMessages: () => void;
  clearComposerState: () => void;
};

export const useComposerStore = create<ComposerStore>()(
  withDevtools(
    (set) => ({
      replyTo: null,
      forwardMessages: [],
      setReplyTo: (replyTo) =>
        set((state) => ({
          replyTo,
          forwardMessages: replyTo ? [] : state.forwardMessages,
        })),
      setForwardMessages: (messages) =>
        set({
          forwardMessages: messages,
          replyTo: null,
        }),
      clearForwardMessages: () => set({ forwardMessages: [] }),
      clearComposerState: () => set({ replyTo: null, forwardMessages: [] }),
    }),
    "composerStore"
  )
);
