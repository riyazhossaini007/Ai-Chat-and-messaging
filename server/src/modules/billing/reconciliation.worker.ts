import { env } from "../../config/env";
import { billingService } from "./billing.service";
import { billingWebhookService } from "./billing.webhook.service";

let started = false;

const runHourly = async () => {
  try {
    const result = await billingService.reconcileUsageWindow({
      since: new Date(Date.now() - 60 * 60 * 1000),
      applyAdjustments: false,
    });
    console.info(
      JSON.stringify({
        event: "billing.reconciliation.hourly",
        ...result,
        at: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error("[billing.reconciliation.hourly.error]", error);
  }
};

const runDaily = async () => {
  try {
    const result = await billingService.reconcileUsageWindow({
      since: new Date(Date.now() - 24 * 60 * 60 * 1000),
      applyAdjustments: true,
    });
    console.info(
      JSON.stringify({
        event: "billing.reconciliation.daily",
        ...result,
        at: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error("[billing.reconciliation.daily.error]", error);
  }
};

const runSubscriptionProviderReconcile = async () => {
  if (!env.SUBSCRIPTION_RECONCILIATION_ENABLED) return;
  try {
    const result = await billingWebhookService.reconcileSubscriptionsWithProviders({
      limit: env.SUBSCRIPTION_RECONCILIATION_BATCH_SIZE,
    });
    console.info(
      JSON.stringify({
        event: "billing.subscription.reconcile.daily",
        ...result,
        at: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error("[billing.subscription.reconcile.daily.error]", error);
  }
};

export const startBillingWorkers = async () => {
  if (started) return;
  started = true;

  await billingService.ensureBootstrapPlans();
  void runHourly();
  void runDaily();
  void runSubscriptionProviderReconcile();

  setInterval(() => {
    void runHourly();
  }, Math.max(60_000, env.AI_RECONCILIATION_HOURLY_CRON_MS));

  setInterval(() => {
    void runDaily();
  }, Math.max(60_000, env.AI_RECONCILIATION_DAILY_CRON_MS));

  setInterval(() => {
    void runSubscriptionProviderReconcile();
  }, Math.max(60_000, env.SUBSCRIPTION_RECONCILIATION_INTERVAL_MS));
};
