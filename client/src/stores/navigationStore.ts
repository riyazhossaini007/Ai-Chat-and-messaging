import { create } from "zustand";
import { withDevtools } from "./storeUtils";

export type ActiveSection =
  | "userChat"
  | "groupChat"
  | "aiChat"
  | "settings"
  | "profile";

export type ThinSidebarIcon =
  | "chats"
  | "groups"
  | "media"
  | "ai"
  | "settings";

interface NavigationStore {
  activeSection: ActiveSection;
  activeThinSidebarIcon: ThinSidebarIcon;
  isMobileSidebarOpen: boolean;
  setActiveSection: (section: ActiveSection) => void;
  setActiveThinSidebarIcon: (icon: ThinSidebarIcon) => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
}

export const useNavigationStore = create<NavigationStore>()(
  withDevtools(
    (set) => ({
      activeSection: "userChat",
      activeThinSidebarIcon: "chats",
      isMobileSidebarOpen: false,
      setActiveSection: (section) => set({ activeSection: section }),
      setActiveThinSidebarIcon: (icon) => set({ activeThinSidebarIcon: icon }),
      toggleMobileSidebar: () =>
        set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
      closeMobileSidebar: () => set({ isMobileSidebarOpen: false }),
    }),
    "navigationStore"
  )
);
