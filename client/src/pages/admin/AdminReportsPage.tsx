import { useState } from "react";
import AdminOpsShell from "./AdminOpsShell";
import { Card } from "./OpsUi";
import { useAdminReports, useResolveReport } from "../../hooks/useAdminReports";
import { banUserModeration, fetchAdminReportDetail, removeMessageModeration } from "../../api/admin";
import { getApiErrorMessage } from "../../api/api";
import { useAdminAsync, useAdminMutation } from "../../hooks/useAdminAsync";

export default function AdminReportsPage() {
  const [status, setStatus] = useState("");
  const [targetType, setTargetType] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const reports = useAdminReports({ status, targetType });
  const detail = useAdminAsync(() => (selectedId ? fetchAdminReportDetail(selectedId) : Promise.resolve(null)), [selectedId]);
  const resolveReport = useResolveReport();
  const banUser = useAdminMutation(banUserModeration);
  const removeMessage = useAdminMutation(removeMessageModeration);

  const active = detail.data;

  return (
    <AdminOpsShell>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <div className="mb-3 grid gap-2 md:grid-cols-3">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
              <option value="">All Status</option>
              {["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
              <option value="">All Targets</option>
              {["USER", "MESSAGE", "GROUP", "CALL"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" onClick={() => void reports.refetch()} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">Refresh</button>
          </div>
          {(reports.error || detail.error || resolveReport.error || banUser.error || removeMessage.error) ? <p className="mb-2 text-sm text-rose-300">{getApiErrorMessage(reports.error || detail.error || resolveReport.error || banUser.error || removeMessage.error)}</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-zinc-700 text-zinc-400"><th className="py-2">Time</th><th className="py-2">Target</th><th className="py-2">Reason</th><th className="py-2">Status</th></tr></thead>
              <tbody>
                {reports.data?.map((r) => (
                  <tr key={r.id} onClick={() => setSelectedId(r.id)} className={`cursor-pointer border-b border-zinc-800/80 ${selectedId === r.id ? "bg-zinc-800/30" : ""}`}>
                    <td className="py-2">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="py-2">{r.targetType}:{r.targetId}</td>
                    <td className="py-2">{r.reasonCode}</td>
                    <td className="py-2">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-base font-medium">Report Detail</h2>
          {!active ? <p className="text-sm text-zinc-400">Select a report.</p> : null}
          {active ? (
            <div className="space-y-3 text-sm">
              <div>ID: {active.id}</div>
              <div>Reporter: {active.reporterUserId}</div>
              <div>Target: {active.targetType}:{active.targetId}</div>
              <div>Status: {active.status}</div>
              <div>Description: {active.description ?? "-"}</div>
              <div className="flex flex-wrap gap-2">
                {(["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => void resolveReport.mutate(active.id, s).then(() => { void reports.refetch(); void detail.refetch(); })} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs">
                    Set {s}
                  </button>
                ))}
              </div>
              {active.targetType === "USER" ? (
                <button type="button" onClick={() => void banUser.mutate(active.targetId, `Report ${active.id}`).then(() => void reports.refetch())} className="rounded border border-rose-700 bg-rose-900/20 px-3 py-2 text-xs">
                  Ban User
                </button>
              ) : null}
              {active.targetType === "MESSAGE" ? (
                <button type="button" onClick={() => void removeMessage.mutate(active.targetId, `Report ${active.id}`).then(() => void reports.refetch())} className="rounded border border-rose-700 bg-rose-900/20 px-3 py-2 text-xs">
                  Remove Message
                </button>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>
    </AdminOpsShell>
  );
}

