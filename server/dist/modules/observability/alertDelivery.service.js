"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertDeliveryService = void 0;
const env_1 = require("../../config/env");
const sendSlack = async (payload) => {
    const webhook = env_1.env.OBS_SLACK_WEBHOOK_URL || env_1.env.OBS_ALERT_WEBHOOK_URL;
    if (!webhook)
        return { sent: false, channel: "slack", reason: "not_configured" };
    const text = [
        `*${payload.severity}* ${payload.type}`,
        payload.message,
        payload.provider ? `Provider: ${payload.provider}` : null,
        payload.model ? `Model: ${payload.model}` : null,
    ]
        .filter(Boolean)
        .join("\n");
    const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            text,
            blocks: [
                {
                    type: "section",
                    text: { type: "mrkdwn", text },
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `\`\`\`${JSON.stringify(payload.details ?? {}, null, 2).slice(0, 2800)}\`\`\``,
                    },
                },
            ],
        }),
    });
    return { sent: response.ok, channel: "slack", reason: response.ok ? "ok" : "http_error" };
};
const sendEmailViaResend = async (payload) => {
    if (!env_1.env.ALERT_EMAIL_ENABLED) {
        return { sent: false, channel: "email", reason: "disabled" };
    }
    if (env_1.env.ALERT_EMAIL_PROVIDER !== "RESEND") {
        return { sent: false, channel: "email", reason: "provider_not_supported" };
    }
    if (!env_1.env.RESEND_API_KEY || !env_1.env.ALERT_EMAIL_FROM || !env_1.env.ALERT_EMAIL_TO) {
        return { sent: false, channel: "email", reason: "not_configured" };
    }
    const subject = `[${payload.severity}] ${payload.type}: ${payload.message.slice(0, 90)}`;
    const html = `
    <h3>${payload.type}</h3>
    <p><strong>Severity:</strong> ${payload.severity}</p>
    <p><strong>Message:</strong> ${payload.message}</p>
    <p><strong>Provider:</strong> ${payload.provider ?? "-"}</p>
    <p><strong>Model:</strong> ${payload.model ?? "-"}</p>
    <pre>${JSON.stringify(payload.details ?? {}, null, 2)}</pre>
  `;
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env_1.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: env_1.env.ALERT_EMAIL_FROM,
            to: [env_1.env.ALERT_EMAIL_TO],
            subject,
            html,
        }),
    });
    return { sent: response.ok, channel: "email", reason: response.ok ? "ok" : "http_error" };
};
const sendPagerDuty = async (payload) => {
    if (!env_1.env.PAGERDUTY_ENABLED || !env_1.env.PAGERDUTY_ROUTING_KEY) {
        return { sent: false, channel: "pagerduty", reason: "not_configured" };
    }
    const response = await fetch("https://events.pagerduty.com/v2/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            routing_key: env_1.env.PAGERDUTY_ROUTING_KEY,
            event_action: "trigger",
            payload: {
                summary: `[${payload.severity}] ${payload.type}: ${payload.message}`,
                severity: payload.severity.toLowerCase(),
                source: "plaxeai-server",
                custom_details: payload.details ?? {},
            },
        }),
    });
    return { sent: response.ok, channel: "pagerduty", reason: response.ok ? "ok" : "http_error" };
};
const sendOpsgenie = async (payload) => {
    if (!env_1.env.OPSGENIE_ENABLED || !env_1.env.OPSGENIE_API_KEY) {
        return { sent: false, channel: "opsgenie", reason: "not_configured" };
    }
    const response = await fetch("https://api.opsgenie.com/v2/alerts", {
        method: "POST",
        headers: {
            Authorization: `GenieKey ${env_1.env.OPSGENIE_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            message: `[${payload.severity}] ${payload.type}: ${payload.message}`.slice(0, 130),
            description: JSON.stringify(payload.details ?? {}, null, 2).slice(0, 15000),
            priority: payload.severity === "CRITICAL" ? "P1" : payload.severity === "HIGH" ? "P2" : "P3",
            tags: ["plaxeai", "observability", payload.type.toLowerCase()],
            ...(env_1.env.OPSGENIE_TEAM ? { responders: [{ name: env_1.env.OPSGENIE_TEAM, type: "team" }] } : {}),
        }),
    });
    return { sent: response.ok, channel: "opsgenie", reason: response.ok ? "ok" : "http_error" };
};
const deliverAlert = async (payload) => {
    const results = await Promise.all([
        sendSlack(payload),
        sendEmailViaResend(payload),
        sendPagerDuty(payload),
        sendOpsgenie(payload),
    ]);
    console.info(JSON.stringify({
        event: "ops.alert.delivery",
        type: payload.type,
        severity: payload.severity,
        message: payload.message,
        results,
        at: new Date().toISOString(),
    }));
    return results;
};
exports.alertDeliveryService = {
    deliverAlert,
};
