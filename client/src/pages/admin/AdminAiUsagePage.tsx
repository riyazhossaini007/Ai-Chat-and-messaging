import { useMemo, useState } from "react";
import AdminOpsShell from "./AdminOpsShell";
import { Card, MiniLineChart, Stat, fmtUsd } from "./OpsUi";
import { useAdminAIUsage, useAdminAITopUsers } from "../../hooks/useAdminAIUsage";
import { getApiErrorMessage } from "../../api/api";

export default function AdminAiUsagePage() {
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const usage = useAdminAIUsage({ provider, status });
  const topUsers = useAdminAITopUsers({ metric: "tokens" });

  const trend = useMemo(() => usage.data?.trendByDay.map((row) => row.count) ?? [], [usage.data]);

  return (
    <AdminOpsShell>
      <div className="space-y-4">
        <Card>
          <div className="grid gap-2 md:grid-cols-4">
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
              <option value="">All Providers</option>
              <option value="OPENAI">OPENAI</option>
              <option value="OPENROUTER">OPENROUTER</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
              <option value="">All Status</option>
              <option value="OK">OK</option>
              <option value="ERROR">ERROR</option>
            </select>
            <button type="button" onClick={() => void usage.refetch()} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">Refresh</button>
          </div>
          {(usage.error || topUsers.error) ? <p className="mt-2 text-sm text-rose-300">{getApiErrorMessage(usage.error || topUsers.error)}</p> : null}
        </Card>

        {usage.data ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Stat label="Requests" value={String(usage.data.totals.requests)} />
              <Stat label="AI Users" value={String(usage.data.totals.aiUsers)} />
              <Stat label="Tokens In" value={String(usage.data.totals.tokensIn)} />
              <Stat label="Tokens Out" value={String(usage.data.totals.tokensOut)} />
              <Stat label="Cost" value={fmtUsd(usage.data.totals.totalCostUsd)} />
            </div>
            <Card>
              <h2 className="mb-2 text-base font-medium">Request Trend</h2>
              <MiniLineChart values={trend} />
            </Card>
            <Card>
              <h2 className="mb-2 text-base font-medium">Top Users (requests)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-zinc-700 text-zinc-400"><th className="py-2">User</th><th className="py-2">Requests</th><th className="py-2">Tokens</th></tr></thead>
                  <tbody>
                    {usage.data.topUsers.map((u) => (
                      <tr key={u.userId} className="border-b border-zinc-800/80">
                        <td className="py-2">{u.username ?? u.userId}</td>
                        <td className="py-2">{u.requests}</td>
                        <td className="py-2">{u.tokens}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card>
              <h2 className="mb-2 text-base font-medium">Top Users (tokens)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-zinc-700 text-zinc-400"><th className="py-2">User</th><th className="py-2">Requests</th><th className="py-2">Tokens</th></tr></thead>
                  <tbody>
                    {topUsers.data?.map((u) => (
                      <tr key={u.userId} className="border-b border-zinc-800/80">
                        <td className="py-2">{u.username ?? u.userId}</td>
                        <td className="py-2">{u.requests}</td>
                        <td className="py-2">{u.tokens}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </AdminOpsShell>
  );
}

