import { useState } from "react";
import type { SettingsSectionProps } from "./SettingsLayout";

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className={`rounded-xl border border-cyan-400/20 bg-zinc-950/60 p-3 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-text-primary">{label}</div>
          {description && <div className="mt-1 text-xs text-text-muted">{description}</div>}
        </div>
        <button
          type="button"
          onClick={onChange}
          disabled={disabled}
          className={`h-6 w-11 rounded-full border transition ${
            checked
              ? "border-cyan-300/45 bg-gradient-to-r from-cyan-300/85 to-emerald-300/80"
              : "border-cyan-400/20 bg-zinc-950/75"
          } ${disabled ? "cursor-not-allowed" : ""}`}
          aria-pressed={checked}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white transition ${
              checked ? "translate-x-[20px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export default function NotificationSettings({ showToast }: SettingsSectionProps) {
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [messageEnabled, setMessageEnabled] = useState(true);
  const [groupEnabled, setGroupEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(false);
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndStart, setDndStart] = useState("22:00");
  const [dndEnd, setDndEnd] = useState("07:00");

  const childDisabled = !globalEnabled;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">Notification Preferences</h3>
        <p className="mt-1 text-xs text-text-muted">Global notification controls with cascading disabled states.</p>

        <div className="mt-4 space-y-3">
          <Toggle
            label="Enable notifications"
            description="Master switch for all message and app notifications."
            checked={globalEnabled}
            onChange={() => {
              setGlobalEnabled((v) => {
                const next = !v;
                showToast(next ? "Notifications enabled" : "Notifications paused");
                return next;
              });
            }}
          />
          <Toggle
            label="Direct message notifications"
            checked={messageEnabled}
            disabled={childDisabled}
            onChange={() => {
              setMessageEnabled((v) => !v);
              showToast("Message notification preference saved");
            }}
          />
          <Toggle
            label="Group notifications"
            checked={groupEnabled}
            disabled={childDisabled}
            onChange={() => {
              setGroupEnabled((v) => !v);
              showToast("Group notification preference saved");
            }}
          />
          <Toggle
            label="Sound alerts"
            checked={soundEnabled}
            disabled={childDisabled}
            onChange={() => {
              setSoundEnabled((v) => !v);
              showToast("Sound preference saved");
            }}
          />
          <Toggle
            label="Vibration alerts"
            checked={vibrationEnabled}
            disabled={childDisabled}
            onChange={() => {
              setVibrationEnabled((v) => !v);
              showToast("Vibration preference saved");
            }}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">Do Not Disturb</h3>
        <p className="mt-1 text-xs text-text-muted">Silence notifications for a scheduled window.</p>

        <div className="mt-4 space-y-3">
          <Toggle
            label="Enable DND schedule"
            checked={dndEnabled}
            disabled={childDisabled}
            onChange={() => {
              setDndEnabled((v) => !v);
              showToast("DND schedule updated");
            }}
          />

          <div className={`grid gap-3 md:grid-cols-2 ${!dndEnabled || childDisabled ? "opacity-60" : ""}`}>
            <label className="space-y-1">
              <span className="text-xs text-text-muted">Start</span>
              <input
                type="time"
                disabled={!dndEnabled || childDisabled}
                value={dndStart}
                onChange={(e) => {
                  setDndStart(e.target.value);
                  showToast("DND start time saved");
                }}
                className="w-full rounded-lg border border-cyan-400/25 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-text-muted">End</span>
              <input
                type="time"
                disabled={!dndEnabled || childDisabled}
                value={dndEnd}
                onChange={(e) => {
                  setDndEnd(e.target.value);
                  showToast("DND end time saved");
                }}
                className="w-full rounded-lg border border-cyan-400/25 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
