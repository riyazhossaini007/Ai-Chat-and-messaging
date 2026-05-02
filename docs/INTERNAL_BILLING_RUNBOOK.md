# Internal Billing Runbook

## Token Accounting
- Store normalized fields:
  - `promptTokens`
  - `completionTokens`
  - `totalTokens`
- Store provider usage payload:
  - `providerUsageRaw`
- Set `estimatorUsed=true` only when provider usage is missing.

## Reconciliation Jobs
- Hourly job:
  - detect mismatches and anomalies
  - log `UsageReconciliation` rows with `OK` or `MISMATCH`
- Daily job:
  - repeat reconciliation
  - apply credit adjustments for mismatches beyond threshold
  - log `ADJUSTED`

## Retry Policy
- Allowed retries:
  - provider timeout
  - provider 5xx
- No retries:
  - 4xx validation/auth/quota
- Retries must reuse the same `requestId`.

## Rounding Rules
- token credits are rounded up at charge time
- minimum charge is 0 credits

## Audit Sources
- `AiRequestLog` for request lifecycle and usage payloads
- `CreditLedger` append-only financial record
- `UsageReconciliation` for mismatch/adjustment history

