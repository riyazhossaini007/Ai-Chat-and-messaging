import type { AiResponseSourceRecord } from "../../api/types";

type Props = {
  title?: string;
  description?: string;
  sources: AiResponseSourceRecord[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
};

const sourceTypeLabel: Record<AiResponseSourceRecord["sourceType"], string> = {
  MESSAGE: "Message",
  FILE: "File",
  KNOWLEDGE: "Knowledge",
  MEMORY: "Memory",
  GROUP_INSIGHT: "Group insight",
};

export default function AiResponseSources({
  title = "Sources used",
  description = "Every answer is linked back to memory, knowledge, or conversation sources.",
  sources,
  loading = false,
  error = null,
  emptyMessage = "No sources available yet.",
}: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 backdrop-blur-xl">
      <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">{title}</div>
      <div className="mt-1 text-xs text-zinc-400">{description}</div>

      {loading ? <div className="mt-3 text-sm text-zinc-400">Loading sources...</div> : null}
      {!loading && error ? (
        <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      ) : null}

      {!loading && !error && sources.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-zinc-800 px-3 py-3 text-xs text-zinc-500">
          {emptyMessage}
        </div>
      ) : null}

      {!loading && !error && sources.length > 0 ? (
        <div className="mt-3 space-y-2">
          {sources.map((source) => (
            <div key={`${source.sourceType}-${source.sourceId}`} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-100">{source.title}</div>
                  <div className="mt-1 text-xs text-zinc-400">{source.snippet}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] uppercase tracking-wide text-cyan-300">
                    {sourceTypeLabel[source.sourceType]}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    {(source.relevanceScore * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
