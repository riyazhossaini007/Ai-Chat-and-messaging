import { useMemo, useState, type FormEvent } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import SemanticSearchResults from "../components/search/SemanticSearchResults";
import { useSemanticSearch } from "../hooks/useSemanticSearch";

const resultTypeOptions = [
  { value: "", label: "All content" },
  { value: "memory", label: "Memory" },
  { value: "knowledge", label: "Knowledge" },
  { value: "decision", label: "Decisions" },
  { value: "task", label: "Tasks" },
  { value: "message", label: "Messages" },
  { value: "file", label: "Files" },
] as const;

export default function SemanticSearchPage() {
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [resultType, setResultType] = useState<
    "" | "memory" | "knowledge" | "decision" | "task" | "message" | "file"
  >("");
  const { groups, loading, error, query: activeQuery, runSearch } = useSemanticSearch();

  const activeFilters = useMemo(
    () => [person ? `Person: ${person}` : null, from ? `From: ${from}` : null, to ? `To: ${to}` : null, resultType ? `Type: ${resultType}` : null].filter(Boolean),
    [from, person, resultType, to]
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    await runSearch({
      q: trimmed,
      person: person.trim() || undefined,
      from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      type: resultType || undefined,
      limit: 24,
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_30%),linear-gradient(180deg,#050816,#090b14)] px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">Semantic Search</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Search by meaning</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Find conversations, memories, tasks, and decisions even when you do not remember the exact words.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-white/10 bg-zinc-950/75 p-4 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find that idea I had about AI payments..."
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/80 px-11 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-3 text-sm font-medium text-zinc-950 disabled:opacity-60"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/6 bg-white/[0.02] p-3 md:grid-cols-4">
              <div className="text-xs text-zinc-400 md:col-span-4">
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal size={12} />
                  Filters
                </span>
              </div>
              <input
                value={person}
                onChange={(event) => setPerson(event.target.value)}
                placeholder="Person or teammate"
                className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500"
              />
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500"
              />
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500"
              />
              <select
                value={resultType}
                onChange={(event) =>
                  setResultType(
                    event.target.value as "" | "memory" | "knowledge" | "decision" | "task" | "message" | "file"
                  )
                }
                className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500"
              >
                {resultTypeOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>

        <div className="mt-6">
          {activeQuery ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Query: {activeQuery}
              </span>
              {activeFilters.map((filter) => (
                <span key={filter} className="rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1">
                  {filter}
                </span>
              ))}
            </div>
          ) : null}

          <SemanticSearchResults groups={groups} loading={loading} error={error} />
        </div>
      </div>
    </div>
  );
}
