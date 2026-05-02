# Reliability Policy

## Provider Health + Circuit Breakers
- Providers are tracked with rolling latency and error/timeout rates.
- Circuit states:
  - `CLOSED`: normal traffic
  - `OPEN`: provider blocked
  - `HALF_OPEN`: limited trial traffic

## Degraded Provider Handling
- If a selected provider is degraded/open:
  - API returns `PROVIDER_DEGRADED`
  - includes `suggestedModels`
- Fallback mode:
  - `AI_FALLBACK_MODE=SUGGEST` (default)
  - `AI_FALLBACK_MODE=AUTO` (automatic substitution based on `AI_FALLBACK_ORDER`)

## Background Queue
- Durable DB-backed queue for non-interactive jobs.
- Exponential backoff + jitter.
- Retries only for transient failures.
- Exhausted jobs move to DLQ.

## Migration Safety
- Use expand -> migrate -> contract.
- Keep feature flags for fast disable:
  - `FEATURE_AI_RELIABILITY`
  - `FEATURE_BG_QUEUE`

