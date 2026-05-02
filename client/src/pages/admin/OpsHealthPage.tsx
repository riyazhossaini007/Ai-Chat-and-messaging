import { useEffect, useMemo, useState } from "react";
import { fetchOpsAlerts, fetchOpsLiveMetrics, type OpsAlertRecord, type OpsProviderHealth } from "../../api/ops.api";
import { getApiErrorMessage } from "../../api/api";
import AdminOpsShell from "./AdminOpsShell";
import { Card } from "./OpsUi";

const badgeClass = (status: string) => {
  if (status === "DOWN") return "bg-rose-500/20 text-rose-200 border-rose-400/40";
  if (status === "DEGRADED") return "bg-amber-500/20 text-amber-200 border-amber-400/40";
  return "bg-emerald-500/20 text-emerald-200 border-emerald-400/40";
};

export default function OpsHealthPage() {
  const [health, setHealth] = useState<OpsProviderHealth[]>([]);
  const [alerts, setAlerts] = useState<OpsAlertRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetchOpsLiveMetrics(24), fetchOpsAlerts(100)])
      .then(([live, incidents]) => {
        setHealth(live.providerHealth);
        setAlerts(incidents);
      })
      .catch((err) => setError(getApiErrorMessage(err)));
  }, []);

  const recentIncidents = useMemo(
    () =>
      alerts
        .filter((item) => item.type === "PROVIDER_DOWNTIME" || item.type === "ERROR_SPIKE")
        .slice(0, 20),
    [alerts]
  );

  return (
    <AdminOpsShell>
      {error ? <p className="text-sm text-rose-300">Failed: {error}</p> : null}
      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 text-base font-medium">Provider Health + Breaker State</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="py-2">Provider</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Breaker</th>
                  <th className="py-2">Error Rate</th>
                  <th className="py-2">Timeout Rate</th>
                  <th className="py-2">p95 Latency</th>
                </tr>
              </thead>
              <tbody>
                {health.map((row) => (
                  <tr key={row.provider} className="border-b border-zinc-800/80">
                    <td className="py-2">{row.provider}</td>
                    <td className="py-2">
                      <span className={`rounded-full border px-2 py-1 text-xs ${badgeClass(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2">{row.breakerState}</td>
                    <td className="py-2">{(row.errorRate * 100).toFixed(1)}%</td>
                    <td className="py-2">{(row.timeoutRate * 100).toFixed(1)}%</td>
                    <td className="py-2">{row.rollingLatencyP95Ms ?? 0} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-medium">Last Incidents</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="py-2">Time</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Severity</th>
                  <th className="py-2">Provider</th>
                  <th className="py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {recentIncidents.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-800/80">
                    <td className="py-2">{new Date(row.triggeredAt).toLocaleString()}</td>
                    <td className="py-2">{row.type}</td>
                    <td className="py-2">{row.severity}</td>
                    <td className="py-2">{row.provider ?? "-"}</td>
                    <td className="py-2">{row.message}</td>
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
