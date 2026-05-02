import { useState } from "react";
import AdminOpsShell from "./AdminOpsShell";
import { Card } from "./OpsUi";
import { useAdminAuditLogs } from "../../hooks/useAdminAuditLogs";
import { getApiErrorMessage } from "../../api/api";

export default function AdminAuditLogsPage() {
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const logs = useAdminAuditLogs({ action, targetType, limit: 100 });

  return (
    <AdminOpsShell>
      <div className="space-y-4">
        <Card>
          <div className="grid gap-2 md:grid-cols-3">
            <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Action contains..." className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
            <input value={targetType} onChange={(e) => setTargetType(e.target.value)} placeholder="Target type" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
            <button type="button" onClick={() => void logs.refetch()} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">Refresh</button>
          </div>
          {logs.error ? <p className="mt-2 text-sm text-rose-300">{getApiErrorMessage(logs.error)}</p> : null}
        </Card>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-zinc-700 text-zinc-400"><th className="py-2">Time</th><th className="py-2">Action</th><th className="py-2">Actor</th><th className="py-2">Target</th><th className="py-2">Meta</th></tr></thead>
              <tbody>
                {logs.data?.map((log) => (
                  <tr key={log.id} className="border-b border-zinc-800/80 align-top">
                    <td className="py-2">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="py-2">{log.action}</td>
                    <td className="py-2">{log.actor?.username ?? log.actorUserId}</td>
                    <td className="py-2">{log.targetType}:{log.targetId ?? "-"}</td>
                    <td className="py-2"><pre className="whitespace-pre-wrap text-xs text-zinc-300">{JSON.stringify(log.meta ?? {}, null, 2)}</pre></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminOpsShell>
  );
}

