import { useEffect, useMemo, useState } from "react";
import { fetchOpsLiveMetrics, type OpsLiveMetricsResponse } from "../../api/ops.api";
import { getApiErrorMessage } from "../../api/api";
import AdminOpsShell from "./AdminOpsShell";
import { Card, Stat, fmtUsd } from "./OpsUi";

export default function OpsTodayPage() {
  const [data, setData] = useState<OpsLiveMetricsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetchOpsLiveMetrics(24)
      .then(setData)
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(() => {
    if (!data) return { cost: 0, requests: 0, errors: 0, p95: 0 };
    const requests = data.metrics.reduce((sum, row) => sum + row.ai_requests_total, 0);
    const errors = data.metrics.reduce((sum, row) => sum + row.ai_request_status.error, 0);
    const cost = data.metrics.reduce((sum, row) => sum + row.ai_cost_usd_total, 0);
    const weightedP95 = data.metrics.reduce(
      (sum, row) => sum + row.ai_request_latency_ms.p95 * row.ai_requests_total,
      0
    );
    const p95 = requests > 0 ? weightedP95 / requests : 0;
    return { cost, requests, errors, p95 };
  }, [data]);

  return (
    <AdminOpsShell>
      {loading ? <p className="text-sm text-zinc-400">Loading today metrics...</p> : null}
      {error ? <p className="text-sm text-rose-300">Failed: {error}</p> : null}

      {data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Cost (24h)" value={fmtUsd(totals.cost)} />
            <Stat label="Requests (24h)" value={String(totals.requests)} />
            <Stat label="Errors (24h)" value={String(totals.errors)} />
            <Stat label="p95 Latency" value={`${Math.round(totals.p95)} ms`} />
          </div>

          <Card>
            <h2 className="mb-3 text-base font-medium">Cost / Requests / Errors by Provider + Model</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-700 text-zinc-400">
                    <th className="py-2">Provider</th>
                    <th className="py-2">Model</th>
                    <th className="py-2">Cost</th>
                    <th className="py-2">Requests</th>
                    <th className="py-2">Errors</th>
                    <th className="py-2">p95 Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {data.metrics.map((row) => (
                    <tr key={`${row.provider}-${row.model}`} className="border-b border-zinc-800/80">
                      <td className="py-2">{row.provider}</td>
                      <td className="py-2">{row.model}</td>
                      <td className="py-2">{fmtUsd(row.ai_cost_usd_total)}</td>
                      <td className="py-2">{row.ai_requests_total}</td>
                      <td className="py-2">{row.ai_request_status.error}</td>
                      <td className="py-2">{Math.round(row.ai_request_latency_ms.p95)} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </AdminOpsShell>
  );
}
