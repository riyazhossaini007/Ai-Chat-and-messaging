# Webhook Issues Runbook

## Trigger
- Missing subscription updates, payment mismatches, or alert `BILLING_ANOMALY`
- Provider webhook retries increasing or events stuck in `ERROR`

## Immediate Actions
1. Check webhook event log table:
   - `SubscriptionWebhookEvent` by provider/eventId/status
2. Validate signature failures:
   - Stripe: `STRIPE_WEBHOOK_SECRET`
   - Razorpay: `RAZORPAY_WEBHOOK_SECRET`
3. Confirm endpoint reachability and HTTP 2xx response rates.

## Replay and Recovery
1. Replay failed events from provider dashboard.
2. Ensure idempotency by reusing original event IDs.
3. Run manual provider reconciliation:
   - `POST /billing/admin/subscriptions/reconcile`

## Verification
1. Confirm DB `Subscription.status` and period dates match provider.
2. Confirm no duplicate subscription rows created for same provider subscription ID.
3. Confirm previously errored webhook events are now processed or intentionally ignored (out-of-order).

## Prevention
1. Keep secrets rotated and synced with provider.
2. Exempt webhook routes from generic edge rate limits.
3. Keep daily reconciliation enabled for drift correction.
