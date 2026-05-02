# Load + Chaos Validation (Go/No-Go)

## Scope
- 100 concurrent stream load
- 10% forced timeouts
- retry path validation
- failover drills: provider, Redis, DB latency

## Execute
1. Run load test:
```bash
k6 run server/tests/k6/ai_stream_resilience.js
```
2. Run chaos drill helper (PowerShell):
```powershell
.\server\scripts\chaos-drill.ps1 -ApiBaseUrl "http://localhost:5000" -AdminToken "<ADMIN_JWT>" -ModelToDisable "grok"
```
3. Generate go/no-go report:
```bash
REPORT_API_BASE_URL=http://localhost:5000 REPORT_ADMIN_TOKEN=<ADMIN_JWT> node server/scripts/go-no-go-report.mjs
```

## Pass Criteria
- No duplicate charge anomalies
- Rate limits are active and observable
- p95 latency under target
- Provider downtime alerts fired when breaker opens
- Refund ratio within threshold

## Evidence to archive
- k6 output summary
- `/ops/metrics/live` snapshot
- `/ops/alerts` snapshot
- go/no-go JSON report
