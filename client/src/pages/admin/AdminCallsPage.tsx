import { useMemo, useState } from "react";
import AdminOpsShell from "./AdminOpsShell";
import { Card, MiniLineChart, Stat, fmtPct } from "./OpsUi";
import { useAdminCallDetail, useAdminCallStats, useAdminCalls } from "../../hooks/useAdminCalls";
import { getApiErrorMessage } from "../../api/api";

export default function AdminCallsPage() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const calls = useAdminCalls({ status, q, limit: 50 });
  const detail = useAdminCallDetail(selectedId || undefined);
  const stats = useAdminCallStats();
  const statsData = (stats.data ?? null) as null | {
    totalCalls: number;
    successRate: number;
    droppedRate: number;
    avgDurationSec: number;
    turnRelayRate?: number;
    trendByDay: Array<{ day: string; count: number }>;
  };
  const trend = useMemo(() => (statsData?.trendByDay ?? []).map((row) => Number(row.count ?? 0)), [statsData]);

  return (
    <AdminOpsShell>
      <div className="space-y-4">
        {statsData ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Total Calls" value={String(statsData.totalCalls)} />
            <Stat label="Success" value={fmtPct(statsData.successRate)} />
            <Stat label="Dropped" value={fmtPct(statsData.droppedRate)} />
            <Stat label="Avg Duration" value={`${statsData.avgDurationSec}s`} />
            <Stat label="TURN Rate" value={fmtPct(statsData.turnRelayRate ?? 0)} />
          </div>
        ) : null}
        <Card>
          <h2 className="mb-2 text-base font-medium">Call Trend</h2>
          <MiniLineChart values={trend} />
        </Card>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <div className="mb-3 grid gap-2 md:grid-cols-3">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="call/group/user id" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                <option value="">All Status</option>
                {["ringing","accepted","in_progress","ended","missed","declined","failed","busy","timeout"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="button" onClick={() => { void calls.refetch(); void stats.refetch(); }} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">Refresh</button>
            </div>
            {(calls.error || detail.error || stats.error) ? <p className="mb-2 text-sm text-rose-300">{getApiErrorMessage(calls.error || detail.error || stats.error)}</p> : null}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-zinc-700 text-zinc-400"><th className="py-2">Call</th><th className="py-2">Type</th><th className="py-2">Status</th><th className="py-2">Participants</th></tr></thead>
                <tbody>
                  {calls.data?.map((c) => (
                    <tr key={c.id} onClick={() => setSelectedId(c.id)} className={`cursor-pointer border-b border-zinc-800/80 ${selectedId === c.id ? "bg-zinc-800/30" : ""}`}>
                      <td className="py-2"><div>{c.id}</div><div className="text-xs text-zinc-500">{c.createdBy}</div></td>
                      <td className="py-2">{c.type} {c.isGroup ? "(group)" : ""}</td>
                      <td className="py-2">{c.status}</td>
                      <td className="py-2">{c.participantsCount ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 text-base font-medium">Call Detail</h2>
            {!detail.data ? <p className="text-sm text-zinc-400">Select a call.</p> : null}
            {detail.data ? (
              <div className="space-y-3 text-sm">
                <div>Status: {(detail.data as any).status}</div>
                <div>Created By: {(detail.data as any).createdBy}</div>
                <div>Started: {(detail.data as any).startedAt ? new Date((detail.data as any).startedAt).toLocaleString() : "-"}</div>
                <div>Ended: {(detail.data as any).endedAt ? new Date((detail.data as any).endedAt).toLocaleString() : "-"}</div>
                <div>Failure: {(detail.data as any).failureReason ?? "-"}</div>
                <div>
                  <h3 className="mb-1 text-sm font-medium">Participants</h3>
                  <div className="space-y-1 text-xs">
                    {((detail.data as any).participants ?? []).map((p: any) => (
                      <div key={p.id ?? p.userId}>{p.userId} - {p.status}</div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium">Events</h3>
                  <div className="max-h-56 overflow-auto space-y-1 text-xs">
                    {((detail.data as any).events ?? []).map((e: any) => (
                      <div key={e.id}>{new Date(e.createdAt).toLocaleString()} - {e.eventType}</div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </AdminOpsShell>
  );
}
