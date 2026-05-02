# k6 Load Test: AI Stream Resilience

## Purpose
- 100 concurrent streaming users
- 10% forced client-side timeouts
- retries enabled on retry-safe errors
- validates rate limits, breaker behavior, and latency targets

## Prerequisites
- k6 installed (`k6 version`)
- paid/admin test account token
- running server + Redis + database

## Env vars
- `K6_API_BASE_URL` (default: `http://localhost:5000`)
- `K6_AUTH_TOKEN` (required)
- `K6_MODEL` (default: `openai`)
- `K6_VUS` (default: `100`)
- `K6_DURATION` (default: `2m`)
- `K6_MAX_RETRIES` (default: `2`)

## Run
```bash
k6 run server/tests/k6/ai_stream_resilience.js
```

## Output signals to review
- `stream_success_rate`
- `stream_latency` (p95)
- `rate_limited_rate`
- `breaker_trigger_rate`
- `duplicate_charge_suspected` (must be 0)

## Post-test checks
- `GET /ops/metrics/live?hours=1`
- `GET /ops/alerts?limit=100`
- `GET /billing/admin/ledger?limit=500`
- `GET /billing/admin/requests?limit=500`
