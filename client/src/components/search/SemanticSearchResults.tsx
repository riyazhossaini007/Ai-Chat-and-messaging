import { Link as LinkIcon } from "lucide-react";
import type { SemanticSearchResultGroup } from "../../api/types";

type Props = {
  groups: SemanticSearchResultGroup[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
};

const formatSourceLocation = (sourceLocation: Record<string, unknown>) => {
  const parts = [
    sourceLocation.groupId ? `Group ${String(sourceLocation.groupId)}` : null,
    sourceLocation.chatId ? `Chat ${String(sourceLocation.chatId)}` : null,
    sourceLocation.messageId ? `Message ${String(sourceLocation.messageId)}` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "Open source";
};

export default function SemanticSearchResults({
  groups,
  loading = false,
  error = null,
  emptyMessage = "Search results will appear here in grouped sections.",
}: Props) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-950/65 px-5 py-8 text-sm text-zinc-400 backdrop-blur-xl">
        Searching across memory, knowledge, and conversations...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-8 text-sm text-rose-200">
        {error}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-zinc-800 px-5 py-8 text-sm text-zinc-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.type} className="rounded-3xl border border-white/10 bg-zinc-950/65 p-4 backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">{group.type}</div>
          <div className="mt-3 space-y-3">
            {group.items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-100">{item.title}</div>
                    <div className="mt-1 text-xs text-zinc-400">{item.snippet}</div>
                  </div>
                  <div className="shrink-0 text-[11px] text-cyan-300">
                    {(item.relevanceScore * 100).toFixed(0)}%
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
                  <span>{new Date(item.date).toLocaleString()}</span>
                  <span>{item.resultType}</span>
                  <span className="inline-flex items-center gap-1">
                    <LinkIcon size={12} />
                    {formatSourceLocation(item.sourceLocation)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
