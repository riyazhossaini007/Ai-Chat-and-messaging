import http from "k6/http";
import { check, fail, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const API_BASE_URL = __ENV.K6_API_BASE_URL || "http://localhost:5000";
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || "";
const MODEL = __ENV.K6_MODEL || "openai";
const DURATION = __ENV.K6_DURATION || "2m";
const VUS = Number(__ENV.K6_VUS || "100");
const MAX_RETRIES = Number(__ENV.K6_MAX_RETRIES || "2");

if (!AUTH_TOKEN) {
  fail("K6_AUTH_TOKEN is required");
}

export const options = {
  scenarios: {
    ai_stream_load: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.15"],
    stream_success_rate: ["rate>0.85"],
    stream_latency: ["p(95)<12000"],
    rate_limited_rate: ["rate<0.35"],
    breaker_trigger_rate: ["rate>=0"],
  },
};

const streamSuccessRate = new Rate("stream_success_rate");
const rateLimitedRate = new Rate("rate_limited_rate");
const breakerTriggerRate = new Rate("breaker_trigger_rate");
const duplicateChargeSuspected = new Counter("duplicate_charge_suspected");
const streamLatency = new Trend("stream_latency", true);

function randomUuid() {
  // RFC4122 v4-style UUID for requestId idempotency
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function buildPayload(requestId) {
  return JSON.stringify({
    requestId,
    model: MODEL,
    temperature: 0.2,
    maxTokens: 256,
    messages: [
      { role: "system", content: "You are concise." },
      { role: "user", content: `load-test prompt ${requestId}: summarize in one line` },
    ],
  });
}

function postWithRetry(url, body, headers, timeout, maxRetries) {
  let attempt = 0;
  let response = null;
  while (attempt <= maxRetries) {
    response = http.post(url, body, {
      headers,
      timeout,
      tags: { attempt: String(attempt) },
    });
    const retryable =
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500 ||
      response.error_code !== 0;
    if (!retryable) return response;
    attempt += 1;
    if (attempt <= maxRetries) sleep(Math.min(0.25 * attempt, 1));
  }
  return response;
}

export default function () {
  const requestId = randomUuid();
  const url = `${API_BASE_URL}/ai/chat/stream`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };

  const forcedTimeout = Math.random() < 0.1;
  const timeout = forcedTimeout ? "1200ms" : "30s";
  const started = Date.now();
  const response = postWithRetry(url, buildPayload(requestId), headers, timeout, MAX_RETRIES);
  const latencyMs = Date.now() - started;
  streamLatency.add(latencyMs);

  const isSuccess = response && response.status === 200;
  streamSuccessRate.add(isSuccess);
  rateLimitedRate.add(response && response.status === 429);
  const body = response ? String(response.body || "") : "";
  const breakerTriggered =
    response && response.status === 503 && (body.includes("PROVIDER_DEGRADED") || body.includes("degraded"));
  breakerTriggerRate.add(Boolean(breakerTriggered));

  check(response, {
    "status is expected": (r) => [200, 402, 429, 503].includes(r.status),
  });

  if (response && response.status === 200) {
    const doneCount = (body.match(/"type":"done"/g) || []).length;
    if (doneCount > 1) {
      // Should never happen; heuristic for potential idempotency/billing risk
      duplicateChargeSuspected.add(1);
    }
  }

  sleep(Math.random() * 0.2);
}
