import { useEffect, useMemo, useState } from "react";
import { fetchOpsDailyDashboard, fetchOpsLiveMetrics, type DailyAiCostRow, type OpsLiveMetricsResponse } from "../../api/ops.api";
import { getApiErrorMessage } from "../../api/api";
import AdminOpsShell from "./AdminOpsShell";
import { Card, Stat, fmtPct } from "./OpsUi";

export default function OpsBillingPage() {
  const [live, setLive] = useState<OpsLiveMetricsResponse | null>(null);
  const [rows, setRows] = useState<DailyAiCostRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetchOpsLiveMetrics(24), fetchOpsDailyDashboard(7)])
      .then(([liveData, daily]) => {
        setLive(liveData);
        setRows(daily.rows);
      })
      .catch((err) => setError(getApiErrorMessage(err)));
  }, []);

  const today = useMemo(() => {
    const key = new Date().toISOString().slice(0, 10);
    return rows.filter((row) => row.date.slice(0, 10) === key);
  }, [rows]);

  const refundCount = useMemo(
    () => today.reduce((sum, row) => sum + (row.refunds > 0 ? 1 : 0), 0),
    [today]
  );

  const estimatorUsedPct = useMemo(() => {
    if (!live) return 0;
    const totalReq = live.metrics.reduce((sum, row) => sum + row.ai_requests_total, 0);
    if (totalReq <= 0) return 0;
    const weighted = live.metrics.reduce(
      (sum, row) => sum + row.estimator_rate * row.ai_requests_total,
      0
    );
    return weighted / totalReq;
  }, [live]);

  return (
    <AdminOpsShell>
      {error ? <p className="text-sm text-rose-300">Failed: {error}</p> : null}
      {live ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Stat label="Paywall Blocks (24h)" value={String(live.paywallBlocks)} />
            <Stat label="Refund Count (today)" value={String(refundCount)} />
            <Stat label="Estimator Used %" value={fmtPct(estimatorUsedPct)} />
          </div>

          <Card>
            <h2 className="mb-3 text-base font-medium">Billing Signals by Provider + Model (24h)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-700 text-zinc-400">
                    <th className="py-2">Provider</th>
                    <th className="py-2">Model</th>
                    <th className="py-2">Estimator %</th>
                    <th className="py-2">Regen Count</th>
                    <th className="py-2">Total Tokens</th>
                    <th className="py-2">Retries</th>
                  </tr>
                </thead>
                <tbody>
                  {live.metrics.map((row) => (
                    <tr key={`${row.provider}-${row.model}`} className="border-b border-zinc-800/80">
                      <td className="py-2">{row.provider}</td>
                      <td className="py-2">{row.model}</td>
                      <td className="py-2">{fmtPct(row.estimator_rate)}</td>
                      <td className="py-2">{row.ai_regen_total}</td>
                      <td className="py-2">{row.ai_tokens_total.total.toLocaleString()}</td>
                      <td className="py-2">{row.ai_retries_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">Loading billing metrics...</p>
      )}
    </AdminOpsShell>
  );
}
