import { useMemo } from "react";
import AdminOpsShell from "./AdminOpsShell";
import { Card, MiniLineChart, Stat, fmtPct, fmtUsd } from "./OpsUi";
import { useAdminOverviewStats } from "../../hooks/useAdminOverviewStats";

export default function AdminOverviewPage() {
  const { data, error, isLoading } = useAdminOverviewStats();

  const messageTrend = useMemo(() => data?.activity.messagesByDay.map((d) => d.count) ?? [], [data]);
  const aiTrend = useMemo(() => data?.ai.aiByDay.map((d) => d.count) ?? [], [data]);
  const callTrend = useMemo(() => data?.calls.callsByDay.map((d) => d.count) ?? [], [data]);

  return (
    <AdminOpsShell>
      {isLoading ? <p className="text-sm text-zinc-400">Loading overview...</p> : null}
      {error ? <p className="text-sm text-rose-300">{String((error as Error)?.message ?? error)}</p> : null}
      {data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Users" value={String(data.users.totalUsers)} />
            <Stat label="DAU" value={String(data.activity.dau)} />
            <Stat label="AI Requests" value={String(data.ai.aiRequests)} />
            <Stat label="Calls Success" value={fmtPct(data.calls.successRate)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="mb-2 text-base font-medium">Billing & Moderation</h2>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Paid Users" value={String(data.billing.paidUsers)} />
                <Stat label="Complimentary" value={String(data.billing.complimentaryUsers)} />
                <Stat label="AI Cost" value={fmtUsd(data.ai.estimatedCostUsd)} />
                <Stat label="Open Reports" value={String(data.moderation.reportsOpen)} />
              </div>
            </Card>
            <Card>
              <h2 className="mb-2 text-base font-medium">Calls</h2>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Total Calls" value={String(data.calls.totalCalls)} />
                <Stat label="Avg Duration" value={`${data.calls.avgDurationSec}s`} />
                <Stat label="Failed" value={String(data.calls.failedCalls)} />
                <Stat label="Dropped" value={String(data.calls.droppedCalls)} />
              </div>
            </Card>
          </div>
          <Card>
            <h2 className="mb-2 text-base font-medium">Messages Trend</h2>
            <MiniLineChart values={messageTrend} />
          </Card>
          <Card>
            <h2 className="mb-2 text-base font-medium">AI Trend</h2>
            <MiniLineChart values={aiTrend} />
          </Card>
          <Card>
            <h2 className="mb-2 text-base font-medium">Calls Trend</h2>
            <MiniLineChart values={callTrend} />
          </Card>
        </div>
      ) : null}
    </AdminOpsShell>
  );
}

