import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage } from "../../api/api";
import {
  assignUserRole,
  fetchRoleAuditLogs,
  fetchRoleUsers,
  revokeUserRole,
  startAdminStepUp,
  verifyAdminStepUp,
  type RoleAuditRow,
  type SecurityUserRoleRow,
} from "../../api/securityAdmin.api";
import AdminOpsShell from "./AdminOpsShell";

const ALL_ROLES = ["USER", "MODERATOR", "ADMIN", "SUPERADMIN"] as const;
type AppRole = (typeof ALL_ROLES)[number];

const uuid = () => crypto.randomUUID();

export default function AdminRolesPage() {
  const [users, setUsers] = useState<SecurityUserRoleRow[]>([]);
  const [audits, setAudits] = useState<RoleAuditRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [stepUpToken, setStepUpToken] = useState("");
  const [stepUpExpiresAt, setStepUpExpiresAt] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRows, auditRows] = await Promise.all([fetchRoleUsers(query, 100), fetchRoleAuditLogs(100)]);
      setUsers(usersRows);
      setAudits(auditRows);
      setError("");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onStartStepUp = async () => {
    try {
      const result = await startAdminStepUp({
        password,
        reason: "Role management operation",
      });
      setChallengeId(result.challengeId);
      setStepUpToken("");
      setStepUpExpiresAt("");
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const onVerifyStepUp = async () => {
    try {
      const result = await verifyAdminStepUp({ challengeId, otp });
      setStepUpToken(result.stepUpToken);
      setStepUpExpiresAt(result.expiresAt);
      setOtp("");
      setError("");
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const onAssign = async (userId: string, role: AppRole) => {
    const reason = prompt(`Reason for assigning ${role} to ${userId}:`)?.trim() ?? "";
    if (!reason) return;
    if (!stepUpToken) {
      setError("Step-up token required. Complete step-up verification first.");
      return;
    }
    try {
      await assignUserRole({
        userId,
        role,
        reason,
        requestId: uuid(),
        stepUpToken,
      });
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const onRevoke = async (userId: string, role: AppRole) => {
    const reason = prompt(`Reason for revoking ${role} from ${userId}:`)?.trim() ?? "";
    if (!reason) return;
    if (!stepUpToken) {
      setError("Step-up token required. Complete step-up verification first.");
      return;
    }
    try {
      await revokeUserRole({
        userId,
        role,
        reason,
        requestId: uuid(),
        stepUpToken,
      });
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <AdminOpsShell>
      <div className="space-y-4">
        <section className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-4">
          <h2 className="mb-3 text-base font-medium">SUPERADMIN Step-Up (re-auth + OTP)</h2>
          <div className="grid gap-2 md:grid-cols-4">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={onStartStepUp}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-3 py-2 text-sm"
            >
              Start Step-Up
            </button>
            <input
              type="text"
              placeholder="OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={onVerifyStepUp}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-2 text-sm"
            >
              Verify OTP
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Challenge: {challengeId || "-"} | token expires:{" "}
            {stepUpExpiresAt ? new Date(stepUpExpiresAt).toLocaleString() : "-"}
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-medium">Role Management</h2>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search user"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          {loading ? <p className="text-sm text-zinc-400">Loading users...</p> : null}
          {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="py-2">User</th>
                  <th className="py-2">Roles</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-zinc-800/80">
                    <td className="py-2">
                      <p>{user.username}</p>
                      <p className="text-xs text-zinc-500">{user.id}</p>
                    </td>
                    <td className="py-2">{user.roles.join(", ") || "USER"}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {ALL_ROLES.map((role) => (
                          <button
                            key={`${user.id}-${role}-assign`}
                            type="button"
                            onClick={() => onAssign(user.id, role)}
                            className="rounded border border-emerald-700 bg-emerald-900/20 px-2 py-1 text-xs"
                          >
                            +{role}
                          </button>
                        ))}
                        {ALL_ROLES.map((role) => (
                          <button
                            key={`${user.id}-${role}-revoke`}
                            type="button"
                            onClick={() => onRevoke(user.id, role)}
                            className="rounded border border-rose-700 bg-rose-900/20 px-2 py-1 text-xs"
                          >
                            -{role}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-4">
          <h2 className="mb-3 text-base font-medium">Role Audit Logs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="py-2">Time</th>
                  <th className="py-2">Action</th>
                  <th className="py-2">Actor</th>
                  <th className="py-2">Target</th>
                  <th className="py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-800/80">
                    <td className="py-2">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="py-2">{item.action}</td>
                    <td className="py-2">{item.actorUserId}</td>
                    <td className="py-2">{item.targetUserId ?? "-"}</td>
                    <td className="py-2">{item.reason ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminOpsShell>
  );
}
