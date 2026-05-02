import { getApiErrorMessage } from "../api/api";
import { useSettingsStore } from "../stores/settingsStore";
import type { SettingsSectionProps } from "./SettingsLayout";

const FIELD_CLASS =
  "w-full rounded-lg border border-cyan-400/25 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-300/70";

export default function GeneralSettings({ showToast }: SettingsSectionProps) {
  const settings = useSettingsStore((state) => state.settings);
  const isLoading = useSettingsStore((state) => state.isLoading);
  const isSaving = useSettingsStore((state) => state.isSaving);
  const error = useSettingsStore((state) => state.error);
  const patchSettings = useSettingsStore((state) => state.patchSettings);

  const controlsDisabled = isLoading || isSaving;
  const language = settings?.language ?? "en";
  const timeZone = settings?.timeZone ?? "America/New_York";
  const dateFormat = settings?.dateFormat ?? "MM/DD/YYYY";
  const autoStart = settings?.autoStart ?? false;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">Locale & Time</h3>
        <p className="mt-1 text-xs text-text-muted">Configure language, region, and display format preferences.</p>
        {isSaving && <p className="mt-2 text-xs text-text-muted">Saving...</p>}
        {error && <p className="mt-2 text-xs text-semantic-error">{error}</p>}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-text-muted">Language</span>
            <select
              disabled={controlsDisabled}
              value={language}
              onChange={(e) => {
                const next = e.target.value as "en";
                void patchSettings({ language: next })
                  .then(() => showToast("Language updated"))
                  .catch((updateError: unknown) => {
                    showToast(getApiErrorMessage(updateError), "danger");
                  });
              }}
              className={FIELD_CLASS}
            >
              <option value="en">English (US)</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-text-muted">Time zone</span>
            <select
              disabled={controlsDisabled}
              value={timeZone}
              onChange={(e) => {
                const next = e.target.value as
                  | "America/New_York"
                  | "America/Chicago"
                  | "America/Denver"
                  | "America/Los_Angeles"
                  | "Asia/Kolkata";
                void patchSettings({ timeZone: next })
                  .then(() => showToast("Time zone saved"))
                  .catch((updateError: unknown) => {
                    showToast(getApiErrorMessage(updateError), "danger");
                  });
              }}
              className={FIELD_CLASS}
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Asia/Kolkata">India Standard Time (IST)</option>
            </select>
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-text-muted">Date & time format</span>
            <select
              disabled={controlsDisabled}
              value={dateFormat}
              onChange={(e) => {
                const next = e.target.value as "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
                void patchSettings({ dateFormat: next })
                  .then(() => showToast("Date format updated"))
                  .catch((updateError: unknown) => {
                    showToast(getApiErrorMessage(updateError), "danger");
                  });
              }}
              className={FIELD_CLASS}
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">Desktop Behavior</h3>
        <p className="mt-1 text-xs text-text-muted">Auto-launch the app when your system starts.</p>

        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() => {
            const next = !autoStart;
            void patchSettings({ autoStart: next })
              .then(() => {
                showToast(next ? "Auto-start enabled" : "Auto-start disabled");
              })
              .catch((updateError: unknown) => {
                showToast(getApiErrorMessage(updateError), "danger");
              });
          }}
          className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${
            autoStart
              ? "border-cyan-300/40 bg-gradient-to-r from-cyan-300/85 to-emerald-300/80 text-zinc-950"
              : "border-cyan-400/25 text-zinc-300 hover:bg-white/5"
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${autoStart ? "bg-white" : "bg-text-muted"}`}
          />
          {autoStart ? "On" : "Off"}
        </button>
      </section>
    </div>
  );
}
