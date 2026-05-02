import { useEffect, useMemo, useState } from "react";
import type { SettingsSectionProps } from "./SettingsLayout";
import { fetchAiModelConfig } from "../api/ai.api";
import { useAuthStore } from "../stores/authStore";

const FIELD_CLASS =
  "w-full rounded-lg border border-cyan-400/25 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-300/70";

const DEFAULT_MODEL_KEY = "plaxeai_default_model";
const AUTO_SWITCH_KEY = "plaxeai_auto_switch_suggestion";

export default function AISettings({ showToast, requestConfirm }: SettingsSectionProps) {
  const user = useAuthStore((store) => store.user);
  const [assistantEnabled, setAssistantEnabled] = useState(true);
  const [defaultModel, setDefaultModel] = useState("openrouter");
  const [modelOptions, setModelOptions] = useState<string[]>(["openrouter", "openai", "claude", "gemini", "grok"]);
  const [modelLabels, setModelLabels] = useState<Record<string, string>>({});
  const [autoSwitchSuggestion, setAutoSwitchSuggestion] = useState(false);

  const credits = useMemo(() => {
    const total = user?.credits.totalCredits ?? 0;
    const used = user?.credits.usedCredits ?? 0;
    return {
      used,
      total,
      remaining: user?.credits.remainingCredits ?? 0,
      resetLabel: "Subscription/credit cycle dependent",
    };
  }, [user?.credits.remainingCredits, user?.credits.totalCredits, user?.credits.usedCredits]);

  const usagePercent = credits.total > 0 ? Math.round((credits.used / credits.total) * 100) : 0;

  useEffect(() => {
    const rawDefault = localStorage.getItem(DEFAULT_MODEL_KEY);
    if (rawDefault) setDefaultModel(rawDefault);
    const rawAuto = localStorage.getItem(AUTO_SWITCH_KEY);
    setAutoSwitchSuggestion(rawAuto === "1");
  }, []);

  useEffect(() => {
    void fetchAiModelConfig()
      .then((config) => {
        const nextOptions = config.models.length > 0 ? config.models : ["openrouter"];
        setModelOptions(nextOptions);
        setModelLabels(config.modelLabels ?? {});
        if (!nextOptions.includes(defaultModel)) {
          const nextDefault = config.defaultModel || nextOptions[0];
          setDefaultModel(nextDefault);
          localStorage.setItem(DEFAULT_MODEL_KEY, nextDefault);
        }
      })
      .catch(() => undefined);
  }, [defaultModel]);

  const toggleAssistant = async () => {
    if (assistantEnabled) {
      const confirmed = await requestConfirm({
        title: "Disable AI assistant?",
        body: "You can re-enable it anytime from this section. AI suggestions and assistant actions will be paused.",
        confirmLabel: "Disable AI",
      });
      if (!confirmed) return;
    }
    setAssistantEnabled((value) => !value);
    showToast(assistantEnabled ? "AI assistant disabled" : "AI assistant enabled");
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">Assistant Controls</h3>
        <p className="mt-1 text-xs text-text-muted">Configure model defaults and automation for AI chat.</p>

        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={toggleAssistant}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              assistantEnabled
                ? "border-cyan-400/45 bg-zinc-950/70 text-zinc-100"
                : "border-cyan-400/20 bg-zinc-950/60 text-zinc-300"
            }`}
          >
            {assistantEnabled ? "AI assistant: Enabled" : "AI assistant: Disabled"}
          </button>

          <label className="space-y-1">
            <span className="text-xs text-text-muted">Default model</span>
            <select
              disabled={!assistantEnabled}
              value={defaultModel}
              onChange={(event) => {
                const next = event.target.value;
                setDefaultModel(next);
                localStorage.setItem(DEFAULT_MODEL_KEY, next);
                showToast("Default model updated");
              }}
              className={`${FIELD_CLASS} ${!assistantEnabled ? "opacity-60" : ""}`}
            >
              {modelOptions.map((entry) => (
                <option key={entry} value={entry}>
                  {modelLabels[entry] ?? entry}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between rounded-xl border border-cyan-400/15 bg-zinc-950/65 px-3 py-2">
            <span className="text-xs text-zinc-300">Enable auto-switch suggestion</span>
            <input
              type="checkbox"
              checked={autoSwitchSuggestion}
              onChange={(event) => {
                const next = event.target.checked;
                setAutoSwitchSuggestion(next);
                localStorage.setItem(AUTO_SWITCH_KEY, next ? "1" : "0");
                showToast("Auto-switch suggestion updated");
              }}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">AI Credit Usage</h3>
        <p className="mt-1 text-xs text-text-muted">
          {credits.used} / {credits.total} credits used. {credits.resetLabel}.
        </p>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-950/70">
          <div
            className="h-full bg-gradient-to-r from-cyan-300/85 to-emerald-300/80"
            style={{ width: `${usagePercent}%` }}
          />
        </div>

        <div className="mt-2 text-xs text-text-muted">
          {usagePercent}% consumed. Remaining: {credits.remaining}
        </div>
      </section>
    </div>
  );
}


