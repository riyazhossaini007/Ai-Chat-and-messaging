import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "../api/api";
import { useSettingsStore } from "../stores/settingsStore";
import type { SettingsSectionProps } from "./SettingsLayout";

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
        checked
          ? "border-cyan-400/45 bg-zinc-950/70 text-zinc-100"
          : "border-cyan-400/20 bg-zinc-950/60 text-zinc-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span>{label}</span>
      <span className={`h-2.5 w-2.5 rounded-full ${checked ? "bg-cyan-300" : "bg-zinc-500"}`} />
    </button>
  );
}

const clampMediaQuality = (value: number) => Math.max(10, Math.min(100, Math.round(value)));

export default function ChatSettings({ showToast }: SettingsSectionProps) {
  const settings = useSettingsStore((state) => state.settings);
  const isLoading = useSettingsStore((state) => state.isLoading);
  const fieldSaving = useSettingsStore((state) => state.fieldSaving);
  const patchSettings = useSettingsStore((state) => state.patchSettings);
  const loadStorageUsage = useSettingsStore((state) => state.loadStorageUsage);
  const storageUsage = useSettingsStore((state) => state.storageUsage);
  const storageUsageLoading = useSettingsStore((state) => state.storageUsageLoading);
  const storageUsageError = useSettingsStore((state) => state.storageUsageError);

  const enterToSend = settings?.chat.enterToSend ?? true;
  const autoDownload = settings?.chat.autoDownload ?? true;
  const mediaQuality = settings?.chat.mediaQuality ?? 70;

  const [mediaQualityDraft, setMediaQualityDraft] = useState(mediaQuality);
  const [sliderDebounceSaving, setSliderDebounceSaving] = useState(false);

  useEffect(() => {
    setMediaQualityDraft(mediaQuality);
  }, [mediaQuality]);

  useEffect(() => {
    void loadStorageUsage();
  }, [loadStorageUsage]);

  useEffect(() => {
    if (mediaQualityDraft === mediaQuality) return;
    setSliderDebounceSaving(true);

    const timeout = window.setTimeout(() => {
      void patchSettings({ chat: { mediaQuality: clampMediaQuality(mediaQualityDraft) } })
        .then(() => {
          showToast("Media quality saved");
        })
        .catch((error: unknown) => {
          showToast(getApiErrorMessage(error), "danger");
          setMediaQualityDraft(mediaQuality);
        })
        .finally(() => {
          setSliderDebounceSaving(false);
        });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [mediaQuality, mediaQualityDraft, patchSettings, showToast]);

  const usage = useMemo(() => {
    const breakdown = storageUsage?.breakdown ?? {
      imagesMb: 0,
      videosMb: 0,
      audioMb: 0,
      documentsMb: 0,
    };
    return [
      { label: "Images", value: breakdown.imagesMb, color: "bg-primary-blue" },
      { label: "Videos", value: breakdown.videosMb, color: "bg-cyan-500" },
      { label: "Audio", value: breakdown.audioMb, color: "bg-emerald-500" },
      { label: "Documents", value: breakdown.documentsMb, color: "bg-amber-500" },
    ];
  }, [storageUsage]);

  const totalStorage = storageUsage?.totalMb ?? 0;
  const isEmptyStorage = totalStorage <= 0;
  const isSavingEnter = Boolean(fieldSaving["chat.enterToSend"]);
  const isSavingAutoDownload = Boolean(fieldSaving["chat.autoDownload"]);
  const isSavingQuality = Boolean(fieldSaving["chat.mediaQuality"]) || sliderDebounceSaving;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">Chat Behavior</h3>
        <p className="mt-1 text-xs text-text-muted">Control how messages are composed and media is downloaded.</p>

        {(isSavingEnter || isSavingAutoDownload || isSavingQuality) && (
          <p className="mt-2 text-xs text-text-muted">Saving...</p>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Toggle
            label="Press Enter to send"
            checked={enterToSend}
            disabled={isLoading || isSavingEnter}
            onChange={() => {
              const next = !enterToSend;
              void patchSettings({ chat: { enterToSend: next } })
                .then(() => showToast("Chat input preference saved"))
                .catch((error: unknown) => {
                  showToast(getApiErrorMessage(error), "danger");
                });
            }}
          />
          <Toggle
            label="Auto-download media"
            checked={autoDownload}
            disabled={isLoading || isSavingAutoDownload}
            onChange={() => {
              const next = !autoDownload;
              void patchSettings({ chat: { autoDownload: next } })
                .then(() => showToast("Auto-download preference saved"))
                .catch((error: unknown) => {
                  showToast(getApiErrorMessage(error), "danger");
                });
            }}
          />

          <label className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">Media quality</span>
              <span className="text-xs text-text-muted">
                {mediaQualityDraft < 40 ? "Data saver" : mediaQualityDraft < 80 ? "Balanced" : "Best quality"}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={mediaQualityDraft}
              onChange={(event) => {
                setMediaQualityDraft(clampMediaQuality(Number(event.target.value)));
              }}
              className="w-full accent-primary-blue"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">Storage Usage</h3>
        <p className="mt-1 text-xs text-text-muted">Current uploaded media usage: {totalStorage} MB</p>

        {storageUsageLoading && (
          <div className="mt-4 space-y-3">
            <div className="h-3 w-full animate-pulse rounded-full bg-zinc-950/70" />
            <div className="grid gap-2 md:grid-cols-2">
              <div className="h-10 animate-pulse rounded-xl bg-zinc-950/70" />
              <div className="h-10 animate-pulse rounded-xl bg-zinc-950/70" />
              <div className="h-10 animate-pulse rounded-xl bg-zinc-950/70" />
              <div className="h-10 animate-pulse rounded-xl bg-zinc-950/70" />
            </div>
          </div>
        )}

        {!storageUsageLoading && storageUsageError && (
          <p className="mt-3 text-xs text-semantic-error">{storageUsageError}</p>
        )}

        {!storageUsageLoading && !storageUsageError && isEmptyStorage && (
          <div className="mt-3 rounded-xl border border-cyan-400/15 bg-zinc-950/65 px-3 py-3 text-sm text-zinc-300">
            No media usage yet.
          </div>
        )}

        {!storageUsageLoading && !storageUsageError && !isEmptyStorage && (
          <>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-950/70">
              {usage.map((item) => {
                const width = `${(item.value / totalStorage) * 100}%`;
                return <div key={item.label} className={`inline-block h-full ${item.color}`} style={{ width }} />;
              })}
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {usage.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl border border-cyan-400/15 bg-zinc-950/65 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                    <span className="text-text-primary">{item.label}</span>
                  </div>
                  <span className="text-text-muted">{item.value} MB</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
