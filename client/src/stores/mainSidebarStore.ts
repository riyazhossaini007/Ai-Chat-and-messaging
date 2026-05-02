import { create } from "zustand";
import { withDevtools } from "./storeUtils";

export type MainSidebarMode = "list" | "media" | "settings";
export type MediaScope = "thisChat" | "allMedia";
export type MediaType = "images" | "videos" | "files";

interface MainSidebarStore {
  mode: MainSidebarMode;
  mediaScope: MediaScope;
  mediaType: MediaType;
  setMode: (mode: MainSidebarMode) => void;
  setMediaScope: (scope: MediaScope) => void;
  setMediaType: (type: MediaType) => void;
  resetSidebar: () => void;
}

const initialState: Pick<MainSidebarStore, "mode" | "mediaScope" | "mediaType"> =
  {
    mode: "list",
    mediaScope: "thisChat",
    mediaType: "images",
  };

export const useMainSidebarStore = create<MainSidebarStore>()(
  withDevtools(
    (set) => ({
      ...initialState,
      setMode: (mode) => set({ mode }),
      setMediaScope: (scope) => set({ mediaScope: scope }),
      setMediaType: (type) => set({ mediaType: type }),
      resetSidebar: () => set(initialState),
    }),
    "mainSidebarStore"
  )
);
