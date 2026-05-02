import { useState } from "react";
import AdminOpsShell from "./AdminOpsShell";
import { Card } from "./OpsUi";
import {
  useAdminUsers,
  usePatchAdminUserNote,
  usePatchAdminUserRole,
  usePatchAdminUserStatus,
} from "../../hooks/useAdminUsers";
import { useAdminUserDetail } from "../../hooks/useAdminUserDetail";
import { useAdminEntitlements } from "../../hooks/useAdminEntitlements";
import { getApiErrorMessage } from "../../api/api";

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const users = useAdminUsers({ q, role, status, limit: 50 });
  const detail = useAdminUserDetail(selectedUserId || undefined);
  const entitlements = useAdminEntitlements(selectedUserId || undefined);
  const roleMutation = usePatchAdminUserRole();
  const statusMutation = usePatchAdminUserStatus();
  const noteMutation = usePatchAdminUserNote();

  const selected = detail.data;

  return (
    <AdminOpsShell>
      <div className="space-y-4">
        <Card>
          <div className="grid gap-2 md:grid-cols-4">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
              <option value="">All Roles</option>
              <option value="USER">USER</option>
              <option value="MODERATOR">MODERATOR</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPERADMIN">SUPERADMIN</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
              <option value="">All Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="BANNED">BANNED</option>
              <option value="DELETED">DELETED</option>
            </select>
            <button type="button" onClick={() => void users.refetch()} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">Refresh</button>
          </div>
          {users.error ? <p className="mt-2 text-sm text-rose-300">{getApiErrorMessage(users.error)}</p> : null}
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <h2 className="mb-3 text-base font-medium">Users</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-700 text-zinc-400">
                    <th className="py-2">User</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Plan</th>
                    <th className="py-2">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data?.items.map((u) => (
                    <tr
                      key={u.id}
                      className={`cursor-pointer border-b border-zinc-800/80 ${selectedUserId === u.id ? "bg-zinc-800/30" : ""}`}
                      onClick={() => setSelectedUserId(u.id)}
                    >
                      <td className="py-2">
                        <div>{u.username}</div>
                        <div className="text-xs text-zinc-500">{u.id}</div>
                      </td>
                      <td className="py-2">{u.role}</td>
                      <td className="py-2">{u.status}</td>
                      <td className="py-2">{u.plan}</td>
                      <td className="py-2">{u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-medium">User Detail</h2>
            {!selectedUserId ? <p className="text-sm text-zinc-400">Select a user.</p> : null}
            {detail.error ? <p className="text-sm text-rose-300">{getApiErrorMessage(detail.error)}</p> : null}
            {selected ? (
              <div className="space-y-3 text-sm">
                <div>
                  <div>{selected.username}</div>
                  <div className="text-xs text-zinc-500">{selected.id}</div>
                </div>
                <div>Role: {selected.role}</div>
                <div>Status: {selected.status}</div>
                <div>Messages (7d): {selected.usageSummary7d.messagesSent}</div>
                <div>AI (7d): {selected.usageSummary7d.aiRequests}</div>
                <div>Calls (7d): {selected.usageSummary7d.calls}</div>
                <div className="grid gap-2">
                  <select defaultValue={selected.role} onChange={(e) => void roleMutation.mutate(selected.id, e.target.value as any).then(() => { void detail.refetch(); void users.refetch(); })} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                    <option value="USER">USER</option>
                    <option value="MODERATOR">MODERATOR</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPERADMIN">SUPERADMIN</option>
                  </select>
                  <select defaultValue={selected.status} onChange={(e) => void statusMutation.mutate(selected.id, { status: e.target.value as any }).then(() => { void detail.refetch(); void users.refetch(); })} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="BANNED">BANNED</option>
                    <option value="DELETED">DELETED</option>
                  </select>
                  <textarea defaultValue={selected.adminNote ?? ""} placeholder="Admin note" className="min-h-20 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" id="admin-user-note" />
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById("admin-user-note") as HTMLTextAreaElement | null;
                      void noteMutation.mutate(selected.id, el?.value ?? "").then(() => void detail.refetch());
                    }}
                    className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  >
                    Save Note
                  </button>
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium">Entitlements</h3>
                  <div className="space-y-1 text-xs">
                    {entitlements.data?.map((g) => (
                      <div key={g.id}>
                        {g.featureKey} {g.isRevoked ? "(revoked)" : ""} {g.expiresAt ? `exp ${new Date(g.expiresAt).toLocaleString()}` : ""}
                      </div>
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

