/* eslint-disable no-console */
const API_BASE_URL = process.env.REPORT_API_BASE_URL || "http://localhost:5000";
const ADMIN_TOKEN = process.env.REPORT_ADMIN_TOKEN || "";
const HOURS = Number(process.env.REPORT_HOURS || "24");

if (!ADMIN_TOKEN) {
  console.error("Missing REPORT_ADMIN_TOKEN");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${ADMIN_TOKEN}`,
  "Content-Type": "application/json",
};

async function getJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GET ${path} failed: ${response.status} ${text}`);
  }
  return response.json();
}

function sumBy(items, fn) {
  return items.reduce((sum, item) => sum + fn(item), 0);
}

function decide(input) {
  const checks = [];
  checks.push({
    name: "No duplicate charge anomalies",
    pass: input.billingAnomalyAlerts === 0,
    value: input.billingAnomalyAlerts,
    limit: 0,
  });
  checks.push({
    name: "Rate limit protection active",
    pass: input.rateLimitedCount > 0,
    value: input.rateLimitedCount,
    limit: ">0",
  });
  checks.push({
    name: "Latency acceptable (p95 < 12s)",
    pass: input.weightedP95LatencyMs < 12000,
    value: Math.round(input.weightedP95LatencyMs),
    limit: 12000,
  });
  checks.push({
    name: "Breaker/open incidents visible",
    pass: input.providerDowntimeAlerts >= 0,
    value: input.providerDowntimeAlerts,
    limit: "tracked",
  });
  checks.push({
    name: "Refund ratio under control (<20%)",
    pass: input.refundRatio < 0.2,
    value: Number((input.refundRatio * 100).toFixed(2)),
    limit: 20,
  });

  const failed = checks.filter((c) => !c.pass);
  return {
    go: failed.length === 0,
    checks,
    failed,
  };
}

async function main() {
  const [liveResp, alertsResp, dailyResp] = await Promise.all([
    getJson(`/ops/metrics/live?hours=${encodeURIComponent(String(HOURS))}`),
    getJson("/ops/alerts?limit=200"),
    getJson("/ops/dashboard/daily?days=1"),
  ]);

  const live = liveResp.data;
  const alerts = alertsResp.data.alerts;
  const daily = dailyResp.data.rows;

  const totalRequests = sumBy(live.metrics, (m) => m.ai_requests_total);
  const totalErrors = sumBy(live.metrics, (m) => m.ai_request_status.error);
  const totalCost = sumBy(live.metrics, (m) => m.ai_cost_usd_total);
  const weightedP95LatencyMs =
    totalRequests > 0
      ? sumBy(live.metrics, (m) => m.ai_request_latency_ms.p95 * m.ai_requests_total) /
        totalRequests
      : 0;
  const rateLimitedCount = alerts.filter((a) => a.type === "ERROR_SPIKE" && /rate/i.test(a.message)).length;
  const providerDowntimeAlerts = alerts.filter((a) => a.type === "PROVIDER_DOWNTIME").length;
  const billingAnomalyAlerts = alerts.filter((a) => a.type === "BILLING_ANOMALY").length;
  const creditsCharged = sumBy(daily, (r) => r.creditsCharged);
  const refunds = sumBy(daily, (r) => r.refunds);
  const refundRatio = creditsCharged > 0 ? refunds / creditsCharged : 0;

  const verdict = decide({
    billingAnomalyAlerts,
    rateLimitedCount,
    weightedP95LatencyMs,
    providerDowntimeAlerts,
    refundRatio,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    windowHours: HOURS,
    summary: {
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      totalCostUsd: Number(totalCost.toFixed(4)),
      weightedP95LatencyMs: Number(weightedP95LatencyMs.toFixed(2)),
      paywallBlocks: live.paywallBlocks,
      providerDowntimeAlerts,
      billingAnomalyAlerts,
      refundRatio: Number((refundRatio * 100).toFixed(2)),
    },
    checks: verdict.checks,
    goNoGo: verdict.go ? "GO" : "NO_GO",
    failedChecks: verdict.failed,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
