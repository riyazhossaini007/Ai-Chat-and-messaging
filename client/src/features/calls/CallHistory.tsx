import { useEffect } from "react";
import { useCallStore } from "./callStore";

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export function CallHistory() {
  const open = useCallStore((state) => state.isCallHistoryOpen);
  const close = useCallStore((state) => state.closeCallHistory);
  const history = useCallStore((state) => state.history);
  const filter = useCallStore((state) => state.historyFilter);
  const setFilter = useCallStore((state) => state.setHistoryFilter);
  const fetchHistory = useCallStore((state) => state.fetchHistory);

  useEffect(() => {
    if (!open) return;
    void fetchHistory(true);
  }, [fetchHistory, open, filter]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[155] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Call History</h3>
          <button
            type="button"
            onClick={close}
            className="rounded-md px-2 py-1 text-xs text-zinc-300 hover:bg-white/10"
          >
            Close
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1 text-xs ${
              filter === "all" ? "bg-cyan-500/20 text-cyan-200" : "bg-zinc-900 text-zinc-300"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("missed")}
            className={`rounded-lg px-3 py-1 text-xs ${
              filter === "missed" ? "bg-cyan-500/20 text-cyan-200" : "bg-zinc-900 text-zinc-300"
            }`}
          >
            Missed
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {history.length === 0 && <div className="text-sm text-zinc-400">No call history yet.</div>}
          {history.map((item) => (
            <div key={item.callId} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  {item.type} {item.direction === "incoming" ? "incoming" : "outgoing"}
                </div>
                <div className="text-xs text-zinc-400">{new Date(item.createdAt).toLocaleString()}</div>
              </div>
              <div className="mt-1 text-xs text-zinc-300">
                Status: {item.status} | Participants: {item.participants.join(", ")}
              </div>
              <div className="mt-1 text-xs text-zinc-400">Duration: {formatDuration(item.durationSec)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
