import { useState } from "react";
import AdminOpsShell from "./AdminOpsShell";
import { Card } from "./OpsUi";
import { useAdminEntitlements, useGrantEntitlement, useRevokeEntitlement } from "../../hooks/useAdminEntitlements";
import { getApiErrorMessage } from "../../api/api";

export default function AdminEntitlementsPage() {
  const [userId, setUserId] = useState("");
  const [featureKey, setFeatureKey] = useState("PRO_ACCESS");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const list = useAdminEntitlements(userId || undefined);
  const grant = useGrantEntitlement();
  const revoke = useRevokeEntitlement();

  return (
    <AdminOpsShell>
      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 text-base font-medium">Grant Entitlement</h2>
          <div className="grid gap-2 md:grid-cols-5">
            <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
            <select value={featureKey} onChange={(e) => setFeatureKey(e.target.value)} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
              {["PRO_ACCESS", "AI_UNLIMITED", "CALLING", "GROUP_CALLING", "NO_ADS"].map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <input value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} placeholder="ExpiresAt ISO (optional)" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
            <button type="button" onClick={() => void grant.mutate({ userId, featureKey: featureKey as any, expiresAt: expiresAt || undefined, reason: reason || undefined }).then(() => void list.refetch())} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">Grant</button>
          </div>
          {(grant.error || list.error || revoke.error) ? <p className="mt-2 text-sm text-rose-300">{getApiErrorMessage(grant.error || list.error || revoke.error)}</p> : null}
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-base font-medium">Entitlements</h2>
            <button type="button" onClick={() => void list.refetch()} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs">Refresh</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="py-2">ID</th>
                  <th className="py-2">Feature</th>
                  <th className="py-2">Revoked</th>
                  <th className="py-2">Expires</th>
                  <th className="py-2">Reason</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.map((g) => (
                  <tr key={g.id} className="border-b border-zinc-800/80">
                    <td className="py-2">{g.id}</td>
                    <td className="py-2">{g.featureKey}</td>
                    <td className="py-2">{String(g.isRevoked)}</td>
                    <td className="py-2">{g.expiresAt ? new Date(g.expiresAt).toLocaleString() : "-"}</td>
                    <td className="py-2">{g.reason ?? "-"}</td>
                    <td className="py-2">
                      {!g.isRevoked ? (
                        <button type="button" onClick={() => void revoke.mutate({ entitlementId: g.id }).then(() => void list.refetch())} className="rounded border border-rose-700 bg-rose-900/20 px-2 py-1 text-xs">
                          Revoke
                        </button>
                      ) : null}
                    </td>
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

