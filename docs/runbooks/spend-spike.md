# Spend Spike Runbook

## Trigger
- Alert type: `SPEND_SPIKE`
- Signal: hourly spend crosses absolute or baseline threshold

## Immediate Actions (first 10 minutes)
1. Open live metrics (`/ops/metrics/live?hours=1`) and daily dashboard (`/ops/dashboard/daily?days=7`).
2. Identify top contributors:
   - provider/model with highest `costUsd`
   - users with largest recent token usage
3. Apply temporary controls:
   - reduce max output tokens
   - tighten rate limits (user/IP/token buckets)
   - disable expensive degraded model if needed

## Abuse / Misuse Check
1. Review repeated regenerate patterns and suspicious automation.
2. Check prompt-injection/security events and rate-limit violations.
3. Verify no billing loop/retry loop is causing duplicate spend.

## Verification
1. Confirm spend slope decreases in the next 15-30 minutes.
2. Confirm user-facing quality remains acceptable after throttles.

## Follow-up
1. Adjust model multipliers/pricing config if needed.
2. Add targeted alerts for specific model/provider threshold.
3. Document whether spike was legitimate demand vs abuse.
