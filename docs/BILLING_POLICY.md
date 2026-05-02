# Billing Policy

## How Credits Are Charged
- Credits are charged per AI request based on token usage.
- Token usage source priority:
1. Provider-reported usage
2. Internal estimator (fallback only)
- Model multipliers apply to the base token-credit conversion.

## Charge Rules
- A request is chargeable only when:
1. request status is `OK`
2. output/completion tokens are greater than zero
3. request has not already been charged (`charged=false`)

## Streaming Rules
- Full response delivered: charged.
- Partial stream with usable output and `OK` status: charged.
- Provider error before output: not charged.
- Timeout before output: not charged.
- Server crash mid-stream: not charged.
- User cancellation: not charged unless request reaches `OK` with output tokens.

## Idempotency
- Every generation has a client-generated `requestId` (UUID).
- `requestId` is unique and reused for retries.
- Duplicate billing is prevented by:
1. unique `CreditLedger.requestId`
2. `AiRequestLog.charged` guard

## Refunds
- Refunds are append-only `REFUND` / `CREDIT` ledger entries.
- Original debit entries are never deleted.
- Manual refunds are available to admins.

