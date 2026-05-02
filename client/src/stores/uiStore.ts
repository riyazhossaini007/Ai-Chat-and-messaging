import { create } from "zustand";
import { withDevtools } from "./storeUtils";

export type ModalType = "deleteChat" | "exitGroup" | null;

interface UiStore {
  openModal: ModalType;
  toastMessage: string | null;
  isLoadingOverlayVisible: boolean;
  setOpenModal: (type: Exclude<ModalType, null>) => void;
  closeModal: () => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  setLoadingOverlayVisible: (visible: boolean) => void;
}

export const useUiStore = create<UiStore>()(
  withDevtools(
    (set) => ({
      openModal: null,
      toastMessage: null,
      isLoadingOverlayVisible: false,
      setOpenModal: (type) => set({ openModal: type }),
      closeModal: () => set({ openModal: null }),
      showToast: (message) => set({ toastMessage: message }),
      clearToast: () => set({ toastMessage: null }),
      setLoadingOverlayVisible: (visible) =>
        set({ isLoadingOverlayVisible: visible }),
    }),
    "uiStore"
  )
);
