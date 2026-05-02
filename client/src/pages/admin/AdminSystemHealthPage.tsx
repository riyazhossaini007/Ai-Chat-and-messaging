import { useAdminAsync } from "../../hooks/useAdminAsync";
import { fetchAdminHealth } from "../../api/admin";
import { getApiErrorMessage } from "../../api/api";
import AdminOpsShell from "./AdminOpsShell";
import { Card, Stat } from "./OpsUi";

export default function AdminSystemHealthPage() {
  const health = useAdminAsync(fetchAdminHealth, []);

  return (
    <AdminOpsShell>
      <div className="space-y-4">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-medium">System Health</h2>
            <button type="button" onClick={() => void health.refetch()} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">Refresh</button>
          </div>
          {health.error ? <p className="text-sm text-rose-300">{getApiErrorMessage(health.error)}</p> : null}
          {health.isLoading ? <p className="text-sm text-zinc-400">Loading...</p> : null}
          {health.data ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Stat label="Database" value={String(health.data.db)} />
              <Stat label="Redis" value={String(health.data.redis)} />
              <Stat label="LiveKit" value={String(health.data.livekit)} />
            </div>
          ) : null}
        </Card>
      </div>
    </AdminOpsShell>
  );
}

