import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import SettingsSidebar, { type SettingsSectionId } from "./SettingsSidebar";
import { useSettingsStore } from "../stores/settingsStore";
import { goHomeWithTransition } from "../lib/navigation";

type ToastTone = "success" | "danger";

type ToastState = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ConfirmOptions = {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ToastTone;
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
  resolve?: (value: boolean) => void;
};

export type SettingsSectionProps = {
  showToast: (message: string, tone?: ToastTone) => void;
  requestConfirm: (options: ConfirmOptions) => Promise<boolean>;
  settingsLoading: boolean;
  allowMessagesFromNonContacts: boolean;
  updateAllowMessagesFromNonContacts: (value: boolean) => Promise<void>;
};

const GeneralSettings = lazy(() => import("./GeneralSettings"));
const AppearanceSettings = lazy(() => import("./AppearanceSettings"));
const NotificationSettings = lazy(() => import("./NotificationSettings"));
const PrivacySettings = lazy(() => import("./PrivacySettings"));
const ChatSettings = lazy(() => import("./ChatSettings"));
const AISettings = lazy(() => import("./AISettings"));
const BillingSettings = lazy(() => import("./BillingSettings"));
const DangerZone = lazy(() => import("./DangerZone"));

const SECTION_COMPONENTS: Record<SettingsSectionId, ComponentType<SettingsSectionProps>> = {
  general: GeneralSettings,
  appearance: AppearanceSettings,
  notifications: NotificationSettings,
  privacy: PrivacySettings,
  chats: ChatSettings,
  ai: AISettings,
  billing: BillingSettings,
  advanced: DangerZone,
};

const SECTION_TITLES: Record<SettingsSectionId, string> = {
  general: "General Settings",
  appearance: "Appearance",
  notifications: "Notifications",
  privacy: "Privacy & Security",
  chats: "Chats & Media",
  ai: "AI Settings",
  billing: "Billing & Plans",
  advanced: "Advanced / Danger Zone",
};

export default function SettingsLayout() {
  const navigate = useNavigate();
  const settings = useSettingsStore((state) => state.settings);
  const settingsLoading = useSettingsStore((state) => state.isLoading);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const updateAllowMessagesFromNonContacts = useSettingsStore(
    (state) => state.updateAllowMessagesFromNonContacts
  );

  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false,
    title: "",
    body: "",
  });

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, tone }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2200);
  }, []);

  const requestConfirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirm({
        open: true,
        title: options.title,
        body: options.body,
        confirmLabel: options.confirmLabel ?? "Confirm",
        cancelLabel: options.cancelLabel ?? "Cancel",
        tone: options.tone ?? "danger",
        resolve,
      });
    });
  }, []);

  const ActiveSection = useMemo(() => SECTION_COMPONENTS[activeSection], [activeSection]);

  const closeConfirm = (value: boolean) => {
    confirm.resolve?.(value);
    setConfirm((prev) => ({ ...prev, open: false, resolve: undefined }));
  };

  return (
    <section className="relative h-full w-full overflow-hidden border border-cyan-400/20 bg-[#020617]/88 shadow-[0_35px_90px_-55px_rgba(6,182,212,0.75)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-10 top-0 z-10 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
      <div className="flex h-full flex-col md:flex-row">
        <SettingsSidebar
          activeSection={activeSection}
          onChange={setActiveSection}
          onHomeClick={() => goHomeWithTransition(navigate)}
          onOpsClick={() => navigate("/admin/ops/today")}
        />

        <main className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-zinc-950/35 to-zinc-950/5">
          <div className="w-full max-w-5xl px-4 py-4 md:px-7 md:py-7">
            <div className="mb-4 rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 md:mb-6 md:p-5">
              <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">{SECTION_TITLES[activeSection]}</h1>
              <p className="mt-1 text-sm text-zinc-300">
                Your settings are synced to your account and applied across web and realtime messaging.
              </p>
            </div>

            <Suspense
              fallback={
                <div className="rounded-2xl border border-cyan-400/20 bg-zinc-900/40 p-6 text-sm text-zinc-300">
                  Loading section...
                </div>
              }
            >
              <ActiveSection
                showToast={showToast}
                requestConfirm={requestConfirm}
                settingsLoading={settingsLoading}
                allowMessagesFromNonContacts={settings?.allowMessagesFromNonContacts ?? true}
                updateAllowMessagesFromNonContacts={updateAllowMessagesFromNonContacts}
              />
            </Suspense>
          </div>
        </main>
      </div>

      <div className="pointer-events-none fixed right-4 top-4 z-[80] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border px-4 py-2 text-sm shadow-lg backdrop-blur ${
              toast.tone === "danger"
                ? "border-semantic-error/40 bg-semantic-error/10 text-semantic-error"
                : "border-cyan-400/40 bg-zinc-900/90 text-text-primary"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {confirm.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-400/20 bg-zinc-900/95 p-5 shadow-[0_35px_80px_-55px_rgba(6,182,212,0.9)] backdrop-blur-xl">
            <h3 className="text-lg font-semibold text-white">{confirm.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{confirm.body}</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:bg-white/5"
              >
                {confirm.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={`rounded-lg px-4 py-2 text-sm text-white ${
                  confirm.tone === "danger" ? "bg-semantic-error hover:opacity-90" : "bg-primary-gradient hover:opacity-90"
                }`}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
