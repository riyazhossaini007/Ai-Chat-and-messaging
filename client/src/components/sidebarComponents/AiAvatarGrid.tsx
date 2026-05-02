import { useMemo, useState } from "react";
import { Bot, Lightbulb } from "lucide-react";
import type { AiAvatar } from "./aiAvatars";

type AiAvatarGridProps = {
  avatars: AiAvatar[];
  onSelectAvatar?: (avatar: AiAvatar) => void;
  onRequestAvatar?: (payload: {
    name: string;
    useCase: string;
    tone: string;
  }) => Promise<void> | void;
};

export default function AiAvatarGrid({
  avatars,
  onSelectAvatar,
  onRequestAvatar,
}: AiAvatarGridProps) {
  const [avatarName, setAvatarName] = useState("");
  const [useCase, setUseCase] = useState("");
  const [tone, setTone] = useState("Helpful");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const canSubmit = useMemo(
    () => avatarName.trim().length >= 2 && useCase.trim().length >= 8,
    [avatarName, useCase]
  );

  const submitRequest = async () => {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    setSuccessMessage("");

    const payload = {
      name: avatarName.trim(),
      useCase: useCase.trim(),
      tone: tone.trim(),
    };

    try {
      if (onRequestAvatar) {
        await onRequestAvatar(payload);
      } else {
        const key = "plaxeai_avatar_requests";
        const raw = localStorage.getItem(key);
        const existing = raw ? JSON.parse(raw) : [];
        const next = [
          ...existing,
          {
            ...payload,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
          },
        ];
        localStorage.setItem(key, JSON.stringify(next));
      }

      setAvatarName("");
      setUseCase("");
      setTone("Helpful");
      setSuccessMessage("Request sent. Thanks for helping us shape upcoming avatars.");
    } catch {
      setSuccessMessage("Could not submit right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!avatars.length) {
    return (
      <div className="p-3">
        <div className="rounded-2xl border border-cyan-400/25 bg-zinc-900/55 p-4 shadow-[0_24px_65px_-50px_rgba(34,211,238,0.85)] backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
              <Bot size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">No avatars available yet</div>
              <p className="mt-1 text-xs text-zinc-300">
                AI avatars are coming soon. Tell us what you want and we will prioritize it.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label className="block text-[11px] uppercase tracking-wide text-zinc-400">
              Avatar name
            </label>
            <input
              value={avatarName}
              onChange={(event) => setAvatarName(event.target.value)}
              placeholder="e.g., Mentor Max"
              maxLength={40}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-400"
            />
          </div>

          <div className="mt-3 space-y-2">
            <label className="block text-[11px] uppercase tracking-wide text-zinc-400">
              What should this avatar help with?
            </label>
            <textarea
              value={useCase}
              onChange={(event) => setUseCase(event.target.value)}
              placeholder="e.g., Explain coding bugs in simple words and suggest fixes."
              rows={3}
              maxLength={240}
              className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-400"
            />
          </div>

          <div className="mt-3 space-y-2">
            <label className="block text-[11px] uppercase tracking-wide text-zinc-400">
              Preferred tone
            </label>
            <div className="flex flex-wrap gap-2">
              {["Helpful", "Professional", "Friendly", "Strict"].map((option) => {
                const selected = tone === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTone(option)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      selected
                        ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-100"
                        : "border-zinc-700 text-zinc-300 hover:border-cyan-400/35"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void submitRequest();
            }}
            disabled={!canSubmit || isSubmitting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-gradient px-3 py-2 text-sm font-medium text-white transition hover:opacity-95 disabled:opacity-50"
          >
            <Lightbulb size={14} />
            {isSubmitting ? "Sending request..." : "Suggest this avatar"}
          </button>

          {successMessage && (
            <div className="mt-2 text-xs text-cyan-200">{successMessage}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-3">
      {avatars.map((avatar) => (
        <button
          key={avatar.id}
          type="button"
          onClick={() => onSelectAvatar?.(avatar)}
          className="group flex flex-col items-center rounded-2xl border border-border-subtle bg-bg-elevated/60 px-3 py-3 text-center transition hover:border-primary-blue/50 hover:bg-bg-elevated/80"
        >
          <div className="h-14 w-14 overflow-hidden rounded-full border border-border-subtle bg-bg-surface">
            <img
              src={avatar.avatarUrl}
              alt={avatar.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="mt-2 text-sm font-medium text-text-primary">
            {avatar.name}
          </div>
          {avatar.role && (
            <div className="text-[11px] text-text-muted">{avatar.role}</div>
          )}
        </button>
      ))}
    </div>
  );
}
