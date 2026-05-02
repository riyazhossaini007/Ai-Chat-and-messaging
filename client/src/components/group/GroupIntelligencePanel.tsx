import type { GroupInsightRecord, KnowledgeItemRecord } from "../../api/types";

type Props = {
  loading?: boolean;
  error?: string | null;
  insights: GroupInsightRecord[];
  decisions: KnowledgeItemRecord[];
  tasks: KnowledgeItemRecord[];
};

function IntelligenceList({
  title,
  emptyMessage,
  items,
}: {
  title: string;
  emptyMessage: string;
  items: Array<{ id: string; title: string; shortSummary: string }>;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{title}</div>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900/65 p-3">
            <div className="text-sm font-medium text-zinc-100">{item.title}</div>
            <div className="mt-1 text-xs text-zinc-400">{item.shortSummary}</div>
          </div>
        ))}
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 px-3 py-2 text-xs text-zinc-500">
            {emptyMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function GroupIntelligencePanel({
  loading = false,
  error = null,
  insights,
  decisions,
  tasks,
}: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/45 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-400">Group intelligence</div>
      <div className="mt-1 text-[11px] text-zinc-500">
        Structured decisions, tasks, and summaries generated from group activity.
      </div>

      {loading ? <div className="mt-3 text-sm text-zinc-400">Loading intelligence...</div> : null}
      {!loading && error ? (
        <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="mt-3 space-y-3">
          <IntelligenceList
            title="Weekly summaries"
            emptyMessage="No group summaries yet."
            items={insights.slice(0, 2)}
          />
          <IntelligenceList
            title="Decisions"
            emptyMessage="No decisions captured yet."
            items={decisions.slice(0, 3)}
          />
          <IntelligenceList
            title="Open tasks"
            emptyMessage="No tasks extracted yet."
            items={tasks.slice(0, 3)}
          />
        </div>
      ) : null}
    </div>
  );
}
