import { useState } from "react";
import AdminOpsShell from "./AdminOpsShell";
import { Card } from "./OpsUi";
import { useAdminGroupDetail, useAdminGroups, useDeleteGroup, useFreezeGroup } from "../../hooks/useAdminGroups";
import { getApiErrorMessage } from "../../api/api";

export default function AdminGroupsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const groups = useAdminGroups({ q, status });
  const detail = useAdminGroupDetail(selectedId || undefined);
  const freeze = useFreezeGroup();
  const remove = useDeleteGroup();
  const groupDetail = detail.data as null | {
    id: string;
    title: string;
    status: string;
    _count?: { members: number };
    members?: Array<{ userId: string; role: string; user?: { username?: string } }>;
    recentActivity?: { messages7d: number };
    admins?: Array<{ userId: string; role: string; user?: { username?: string } }>;
  };

  return (
    <AdminOpsShell>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <div className="mb-3 grid gap-2 md:grid-cols-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search group" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
              <option value="">All Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="FROZEN">FROZEN</option>
              <option value="DELETED">DELETED</option>
            </select>
            <button type="button" onClick={() => void groups.refetch()} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">Refresh</button>
          </div>
          {(groups.error || detail.error || freeze.error || remove.error) ? <p className="mb-2 text-sm text-rose-300">{getApiErrorMessage(groups.error || detail.error || freeze.error || remove.error)}</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-zinc-700 text-zinc-400"><th className="py-2">Group</th><th className="py-2">Status</th><th className="py-2">Members</th><th className="py-2">Messages</th></tr></thead>
              <tbody>
                {groups.data?.map((g) => (
                  <tr key={g.id} onClick={() => setSelectedId(g.id)} className={`cursor-pointer border-b border-zinc-800/80 ${selectedId === g.id ? "bg-zinc-800/30" : ""}`}>
                    <td className="py-2"><div>{g.title}</div><div className="text-xs text-zinc-500">{g.id}</div></td>
                    <td className="py-2">{g.status}</td>
                    <td className="py-2">{g.memberCount}</td>
                    <td className="py-2">{g.messageCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-base font-medium">Group Detail</h2>
          {!groupDetail ? <p className="text-sm text-zinc-400">Select a group.</p> : null}
          {groupDetail ? (
            <div className="space-y-3 text-sm">
              <div>{groupDetail.title}</div>
              <div>Status: {groupDetail.status}</div>
              <div>Members: {groupDetail._count?.members ?? groupDetail.members?.length ?? 0}</div>
              <div>Messages7d: {groupDetail.recentActivity?.messages7d ?? 0}</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void freeze.mutate(groupDetail.id, true).then(() => { void groups.refetch(); void detail.refetch(); })} className="rounded border border-amber-700 bg-amber-900/20 px-2 py-1 text-xs">Freeze</button>
                <button type="button" onClick={() => void freeze.mutate(groupDetail.id, false).then(() => { void groups.refetch(); void detail.refetch(); })} className="rounded border border-emerald-700 bg-emerald-900/20 px-2 py-1 text-xs">Unfreeze</button>
                <button type="button" onClick={() => void remove.mutate(groupDetail.id).then(() => { void groups.refetch(); void detail.refetch(); })} className="rounded border border-rose-700 bg-rose-900/20 px-2 py-1 text-xs">Delete</button>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-medium">Admins</h3>
                <div className="space-y-1 text-xs">
                  {(groupDetail.admins ?? []).map((m: any) => (
                    <div key={m.userId}>{m.user?.username ?? m.userId} ({m.role})</div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </AdminOpsShell>
  );
}
