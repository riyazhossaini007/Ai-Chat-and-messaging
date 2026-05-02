import { useEffect, useMemo, useState } from "react";
import { fetchOpsDailyDashboard, type DailyAiCostRow } from "../../api/ops.api";
import { getApiErrorMessage } from "../../api/api";
import AdminOpsShell from "./AdminOpsShell";
import { Card, MiniLineChart, Stat, fmtUsd, fmtPct } from "./OpsUi";

type DayAggregate = {
  date: string;
  costUsd: number;
  marginUsd: number;
};

export default function OpsTrendsPage() {
  const [rows, setRows] = useState<DailyAiCostRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetchOpsDailyDashboard(7)
      .then((payload) => setRows(payload.rows))
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const daily = useMemo<DayAggregate[]>(() => {
    const map = new Map<string, DayAggregate>();
    for (const row of rows) {
      const key = row.date.slice(0, 10);
      const existing = map.get(key) ?? { date: key, costUsd: 0, marginUsd: 0 };
      existing.costUsd += row.costUsd;
      existing.marginUsd += row.marginUsd;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  const totals = useMemo(() => {
    const cost = daily.reduce((sum, day) => sum + day.costUsd, 0);
    const margin = daily.reduce((sum, day) => sum + day.marginUsd, 0);
    return { cost, margin, marginPct: cost > 0 ? margin / cost : 0 };
  }, [daily]);

  return (
    <AdminOpsShell>
      {loading ? <p className="text-sm text-zinc-400">Loading 7-day trends...</p> : null}
      {error ? <p className="text-sm text-rose-300">Failed: {error}</p> : null}

      {!loading && !error ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Stat label="7-Day Cost" value={fmtUsd(totals.cost)} />
            <Stat label="7-Day Margin" value={fmtUsd(totals.margin)} />
            <Stat label="Margin Trend Ratio" value={fmtPct(totals.marginPct)} />
          </div>

          <Card>
            <h2 className="mb-3 text-base font-medium">Cost Trend (Last 7 Days)</h2>
            <MiniLineChart values={daily.map((item) => item.costUsd)} />
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-medium">Margin Trend (Last 7 Days)</h2>
            <MiniLineChart values={daily.map((item) => item.marginUsd)} />
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-medium">Daily Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-700 text-zinc-400">
                    <th className="py-2">Date</th>
                    <th className="py-2">Cost</th>
                    <th className="py-2">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((item) => (
                    <tr key={item.date} className="border-b border-zinc-800/80">
                      <td className="py-2">{item.date}</td>
                      <td className="py-2">{fmtUsd(item.costUsd)}</td>
                      <td className="py-2">{fmtUsd(item.marginUsd)}</td>
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
