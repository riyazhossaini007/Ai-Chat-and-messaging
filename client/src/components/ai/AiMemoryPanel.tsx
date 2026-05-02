import { Pin, PinOff, Trash2 } from "lucide-react";
import type { UserMemoryRecord } from "../../api/types";

type Props = {
  title?: string;
  description?: string;
  items: UserMemoryRecord[];
  loading?: boolean;
  error?: string | null;
  onPin?: (memoryId: string) => void;
  onForget?: (memoryId: string) => void;
};

export default function AiMemoryPanel({
  title = "Relevant memory",
  description = "Personal memory pulled from past conversations, files, and saved context.",
  items,
  loading = false,
  error = null,
  onPin,
  onForget,
}: Props) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-2xl backdrop-blur-xl">
      <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">AI Memory</div>
      <div className="mt-1 text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-xs text-zinc-400">{description}</div>

      {loading ? <div className="mt-4 text-sm text-zinc-400">Searching memory...</div> : null}
      {!loading && error ? (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-xs text-rose-200">
          {error}
        </div>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 px-3 py-3 text-xs text-zinc-500">
          Send a prompt to surface relevant memory.
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-100">{item.title}</div>
                  <div className="mt-1 text-xs text-zinc-400">{item.shortSummary}</div>
                </div>
                {item.pinnedAt ? (
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">
                    Pinned
                  </span>
                ) : null}
              </div>

              <div className="mt-2 text-[11px] text-zinc-500">
                {item.sourceGroupId
                  ? `Group: ${item.sourceGroupId}`
                  : item.sourceConversationId
                    ? `Chat: ${item.sourceConversationId}`
                    : "Saved memory"}
              </div>

              {(onPin || onForget) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {onPin ? (
                    <button
                      type="button"
                      onClick={() => onPin(item.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-950/80 px-2.5 py-1.5 text-[11px] text-zinc-200 transition hover:border-cyan-500/60"
                    >
                      {item.pinnedAt ? <PinOff size={12} /> : <Pin size={12} />}
                      {item.pinnedAt ? "Unpin" : "Pin"}
                    </button>
                  ) : null}
                  {onForget ? (
                    <button
                      type="button"
                      onClick={() => onForget(item.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-700/70 bg-rose-950/20 px-2.5 py-1.5 text-[11px] text-rose-300 transition hover:border-rose-500"
                    >
                      <Trash2 size={12} />
                      Forget
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
