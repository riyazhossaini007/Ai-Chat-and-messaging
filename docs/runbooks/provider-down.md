# Provider Down Runbook

## Trigger
- Alert type: `PROVIDER_DOWNTIME`
- Signal: circuit breaker `OPEN` or provider health `DOWN`

## Immediate Actions (first 5 minutes)
1. Confirm impact in `GET /ai/health/providers`.
2. Disable affected model in admin config (`/ai/admin/config`) or set `enabledModels[model]=false`.
3. Force fallback policy:
   - `AI_FALLBACK_MODE=SUGGEST` (safer) or `AUTO` (faster recovery path).
4. Notify support/status channel with impacted provider/model and ETA.

## Verification
1. Ensure new chat requests are routed to healthy alternatives.
2. Confirm paywall and billing still behave normally (no double charges).
3. Monitor:
   - `errorRate`, `timeoutRate`, `p95 latency`
   - `ai_requests_total{status=error}`

## Recovery
1. Re-enable provider/model once health checks pass consistently.
2. Keep provider in HALF_OPEN/CLOSED observation for 15-30 minutes.
3. Close alert after sustained normal latency/error rates.

## Postmortem Notes
- Incident start/end time
- Root cause category (provider outage, auth, quota, network)
- User impact (failed requests, fallback count)
