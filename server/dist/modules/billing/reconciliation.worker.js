"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBillingWorkers = void 0;
const env_1 = require("../../config/env");
const billing_service_1 = require("./billing.service");
const billing_webhook_service_1 = require("./billing.webhook.service");
let started = false;
const runHourly = async () => {
    try {
        const result = await billing_service_1.billingService.reconcileUsageWindow({
            since: new Date(Date.now() - 60 * 60 * 1000),
            applyAdjustments: false,
        });
        console.info(JSON.stringify({
            event: "billing.reconciliation.hourly",
            ...result,
            at: new Date().toISOString(),
        }));
    }
    catch (error) {
        console.error("[billing.reconciliation.hourly.error]", error);
    }
};
const runDaily = async () => {
    try {
        const result = await billing_service_1.billingService.reconcileUsageWindow({
            since: new Date(Date.now() - 24 * 60 * 60 * 1000),
            applyAdjustments: true,
        });
        console.info(JSON.stringify({
            event: "billing.reconciliation.daily",
            ...result,
            at: new Date().toISOString(),
        }));
    }
    catch (error) {
        console.error("[billing.reconciliation.daily.error]", error);
    }
};
const runSubscriptionProviderReconcile = async () => {
    if (!env_1.env.SUBSCRIPTION_RECONCILIATION_ENABLED)
        return;
    try {
        const result = await billing_webhook_service_1.billingWebhookService.reconcileSubscriptionsWithProviders({
            limit: env_1.env.SUBSCRIPTION_RECONCILIATION_BATCH_SIZE,
        });
        console.info(JSON.stringify({
            event: "billing.subscription.reconcile.daily",
            ...result,
            at: new Date().toISOString(),
        }));
    }
    catch (error) {
        console.error("[billing.subscription.reconcile.daily.error]", error);
    }
};
const startBillingWorkers = async () => {
    if (started)
        return;
    started = true;
    await billing_service_1.billingService.ensureBootstrapPlans();
    void runHourly();
    void runDaily();
    void runSubscriptionProviderReconcile();
    setInterval(() => {
        void runHourly();
    }, Math.max(60000, env_1.env.AI_RECONCILIATION_HOURLY_CRON_MS));
    setInterval(() => {
        void runDaily();
    }, Math.max(60000, env_1.env.AI_RECONCILIATION_DAILY_CRON_MS));
    setInterval(() => {
        void runSubscriptionProviderReconcile();
    }, Math.max(60000, env_1.env.SUBSCRIPTION_RECONCILIATION_INTERVAL_MS));
};
exports.startBillingWorkers = startBillingWorkers;
