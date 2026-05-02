"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const required = (key) => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing env var: ${key}`);
    }
    return value;
};
const requiredBase64Key32 = (key) => {
    const value = required(key);
    const bytes = Buffer.from(value, "base64");
    if (bytes.length !== 32) {
        throw new Error(`${key} must be base64 for exactly 32 bytes`);
    }
    return value;
};
const requireStrongInProduction = (key, minLength = 32) => {
    const value = process.env[key]?.trim() ?? "";
    if (!value) {
        throw new Error(`Missing env var: ${key}`);
    }
    if (value.length < minLength) {
        throw new Error(`${key} must be at least ${minLength} characters in production`);
    }
    return value;
};
const startsWithAny = (value, prefixes) => prefixes.some((prefix) => value.toLowerCase().startsWith(prefix.toLowerCase()));
const isPlaceholderLike = (value) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized)
        return true;
    return (normalized.includes("<") ||
        normalized.includes(">") ||
        normalized.includes("replace-with") ||
        normalized.includes("change-me") ||
        normalized.includes("your_"));
};
const parseKekMap = (primaryId, primaryKeyB64) => {
    const raw = process.env.MESSAGE_KEK_MAP_JSON?.trim() ?? "";
    const merged = {
        [primaryId]: primaryKeyB64,
    };
    if (!raw)
        return merged;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error("MESSAGE_KEK_MAP_JSON must be valid JSON");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("MESSAGE_KEK_MAP_JSON must be an object map");
    }
    for (const [id, value] of Object.entries(parsed)) {
        if (!id || typeof value !== "string") {
            throw new Error("MESSAGE_KEK_MAP_JSON entries must be { id: base64Key }");
        }
        const bytes = Buffer.from(value, "base64");
        if (bytes.length !== 32) {
            throw new Error(`MESSAGE_KEK_MAP_JSON key '${id}' must decode to 32 bytes`);
        }
        merged[id] = value;
    }
    return merged;
};
const MESSAGE_KEK_ID = (process.env.MESSAGE_KEK_ID ?? "primary-v1").trim() || "primary-v1";
const MESSAGE_KEK_B64 = requiredBase64Key32("MESSAGE_KEK_B64");
const MESSAGE_KEK_MAP = parseKekMap(MESSAGE_KEK_ID, MESSAGE_KEK_B64);
exports.env = {
    PORT: Number((process.env.PORT ?? "3000").trim()),
    DATABASE_URL: required("DATABASE_URL"),
    JWT_SECRET: process.env.JWT_SECRET ?? "change-me",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
    NODE_ENV: process.env.NODE_ENV ?? "development",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    OPENAI_DEFAULT_MODEL: process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4.1-mini",
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "",
    OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    OPENROUTER_FREE_MODEL: process.env.OPENROUTER_FREE_MODEL ?? "openrouter/auto",
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1",
    ANTHROPIC_DEFAULT_MODEL: process.env.ANTHROPIC_DEFAULT_MODEL ?? "claude-3-5-sonnet-latest",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
    GEMINI_BASE_URL: process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta",
    GEMINI_DEFAULT_MODEL: process.env.GEMINI_DEFAULT_MODEL ?? "gemini-1.5-flash",
    XAI_API_KEY: process.env.XAI_API_KEY ?? "",
    XAI_BASE_URL: process.env.XAI_BASE_URL ?? "https://api.x.ai/v1",
    XAI_DEFAULT_MODEL: process.env.XAI_DEFAULT_MODEL ?? "grok-2-latest",
    AI_DEFAULT_MODEL: (process.env.AI_DEFAULT_MODEL ?? "openrouter").trim().toLowerCase(),
    AI_ENABLED_MODELS: process.env.AI_ENABLED_MODELS ?? "openrouter,openai,claude,gemini,grok",
    AI_ADMIN_USER_IDS: process.env.AI_ADMIN_USER_IDS ?? "",
    AI_MAX_CONTEXT_MESSAGES: Number(process.env.AI_MAX_CONTEXT_MESSAGES ?? "20"),
    AI_MAX_TOKENS_PER_REQUEST: Number(process.env.AI_MAX_TOKENS_PER_REQUEST ?? "4096"),
    AI_PROVIDER_TIMEOUT_MS: Number(process.env.AI_PROVIDER_TIMEOUT_MS ?? "30000"),
    AI_PROVIDER_MAX_RETRIES: Number(process.env.AI_PROVIDER_MAX_RETRIES ?? "1"),
    AI_REASONING_COOLDOWN_MS: Number(process.env.AI_REASONING_COOLDOWN_MS ?? "5000"),
    AI_RATE_LIMIT_PER_USER_PER_MIN: Number(process.env.AI_RATE_LIMIT_PER_USER_PER_MIN ?? "40"),
    AI_RATE_LIMIT_PER_IP_PER_MIN: Number(process.env.AI_RATE_LIMIT_PER_IP_PER_MIN ?? "80"),
    AI_TOKENS_PER_USER_PER_MIN: Number(process.env.AI_TOKENS_PER_USER_PER_MIN ?? "60000"),
    AI_RECONCILIATION_MISMATCH_THRESHOLD: Number(process.env.AI_RECONCILIATION_MISMATCH_THRESHOLD ?? "500"),
    AI_RECONCILIATION_HOURLY_CRON_MS: Number(process.env.AI_RECONCILIATION_HOURLY_CRON_MS ?? "3600000"),
    AI_RECONCILIATION_DAILY_CRON_MS: Number(process.env.AI_RECONCILIATION_DAILY_CRON_MS ?? "86400000"),
    AI_CB_ERROR_RATE_THRESHOLD: Number(process.env.AI_CB_ERROR_RATE_THRESHOLD ?? "0.4"),
    AI_CB_TIMEOUT_RATE_THRESHOLD: Number(process.env.AI_CB_TIMEOUT_RATE_THRESHOLD ?? "0.3"),
    AI_CB_CONSEC_FAIL_THRESHOLD: Number(process.env.AI_CB_CONSEC_FAIL_THRESHOLD ?? "5"),
    AI_CB_P95_LATENCY_THRESHOLD_MS: Number(process.env.AI_CB_P95_LATENCY_THRESHOLD_MS ?? "10000"),
    AI_CB_OPEN_DURATION_MS: Number(process.env.AI_CB_OPEN_DURATION_MS ?? "30000"),
    AI_CB_HALF_OPEN_TRIALS: Number(process.env.AI_CB_HALF_OPEN_TRIALS ?? "3"),
    AI_PROVIDER_PROBE_INTERVAL_MS: Number(process.env.AI_PROVIDER_PROBE_INTERVAL_MS ?? "20000"),
    AI_FALLBACK_MODE: (process.env.AI_FALLBACK_MODE ?? "SUGGEST").trim().toUpperCase(),
    AI_FALLBACK_ORDER: process.env.AI_FALLBACK_ORDER ?? "openrouter,openai,claude,gemini,grok",
    FEATURE_AI_RELIABILITY: (process.env.FEATURE_AI_RELIABILITY ?? "1").trim() === "1",
    FEATURE_AI_MEMORY: (process.env.FEATURE_AI_MEMORY ?? "1").trim() === "1",
    FEATURE_SEMANTIC_SEARCH: (process.env.FEATURE_SEMANTIC_SEARCH ?? "1").trim() === "1",
    FEATURE_BG_QUEUE: (process.env.FEATURE_BG_QUEUE ?? "1").trim() === "1",
    CALLING_ENABLED: (process.env.CALLING_ENABLED ?? "1").trim() === "1",
    TURN_URL: process.env.TURN_URL ?? "",
    TURN_USERNAME: process.env.TURN_USERNAME ?? "",
    TURN_PASSWORD: process.env.TURN_PASSWORD ?? "",
    LIVEKIT_URL: process.env.LIVEKIT_URL ?? "",
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY ?? "",
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET ?? "",
    AUDIT_SIGNING_SECRET: process.env.AUDIT_SIGNING_SECRET ?? "change-audit-secret",
    REDIS_REST_URL: process.env.REDIS_REST_URL ?? "",
    REDIS_REST_TOKEN: process.env.REDIS_REST_TOKEN ?? "",
    REDIS_REQUIRED: (process.env.REDIS_REQUIRED ??
        ((process.env.NODE_ENV ?? "development") === "production" ? "1" : "0")) === "1",
    AI_REQ_BUCKET_CAPACITY: Number(process.env.AI_REQ_BUCKET_CAPACITY ?? "40"),
    AI_REQ_BUCKET_REFILL_PER_SEC: Number(process.env.AI_REQ_BUCKET_REFILL_PER_SEC ?? "1"),
    AI_IP_BUCKET_CAPACITY: Number(process.env.AI_IP_BUCKET_CAPACITY ?? "80"),
    AI_IP_BUCKET_REFILL_PER_SEC: Number(process.env.AI_IP_BUCKET_REFILL_PER_SEC ?? "2"),
    AI_TOKEN_BUCKET_CAPACITY: Number(process.env.AI_TOKEN_BUCKET_CAPACITY ?? "120000"),
    AI_TOKEN_BUCKET_REFILL_PER_SEC: Number(process.env.AI_TOKEN_BUCKET_REFILL_PER_SEC ?? "2000"),
    AI_STREAM_MAX_DURATION_MS: Number(process.env.AI_STREAM_MAX_DURATION_MS ?? "180000"),
    OBS_ALERT_WEBHOOK_URL: process.env.OBS_ALERT_WEBHOOK_URL ?? "",
    OBS_SLACK_WEBHOOK_URL: process.env.OBS_SLACK_WEBHOOK_URL ?? "",
    ALERT_EMAIL_ENABLED: (process.env.ALERT_EMAIL_ENABLED ?? "0").trim() === "1",
    ALERT_EMAIL_PROVIDER: (process.env.ALERT_EMAIL_PROVIDER ?? "RESEND").trim().toUpperCase(),
    ALERT_EMAIL_FROM: process.env.ALERT_EMAIL_FROM ?? "",
    ALERT_EMAIL_TO: process.env.ALERT_EMAIL_TO ?? "",
    RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
    PAGERDUTY_ENABLED: (process.env.PAGERDUTY_ENABLED ?? "0").trim() === "1",
    PAGERDUTY_ROUTING_KEY: process.env.PAGERDUTY_ROUTING_KEY ?? "",
    OPSGENIE_ENABLED: (process.env.OPSGENIE_ENABLED ?? "0").trim() === "1",
    OPSGENIE_API_KEY: process.env.OPSGENIE_API_KEY ?? "",
    OPSGENIE_TEAM: process.env.OPSGENIE_TEAM ?? "",
    OBS_SPEND_HOURLY_USD_THRESHOLD: Number(process.env.OBS_SPEND_HOURLY_USD_THRESHOLD ?? "50"),
    OBS_SPEND_SPIKE_MULTIPLIER: Number(process.env.OBS_SPEND_SPIKE_MULTIPLIER ?? "2"),
    OBS_ERROR_RATE_THRESHOLD: Number(process.env.OBS_ERROR_RATE_THRESHOLD ?? "0.25"),
    OBS_PROVIDER_P95_MS_THRESHOLD: Number(process.env.OBS_PROVIDER_P95_MS_THRESHOLD ?? "12000"),
    OBS_REFUND_RATE_THRESHOLD: Number(process.env.OBS_REFUND_RATE_THRESHOLD ?? "0.2"),
    OBS_ESTIMATOR_RATE_THRESHOLD: Number(process.env.OBS_ESTIMATOR_RATE_THRESHOLD ?? "0.35"),
    OBS_DLQ_ALERT_THRESHOLD: Number(process.env.OBS_DLQ_ALERT_THRESHOLD ?? "20"),
    OBS_ALERT_EVAL_INTERVAL_MS: Number(process.env.OBS_ALERT_EVAL_INTERVAL_MS ?? "60000"),
    OBS_DAILY_ROLLUP_INTERVAL_MS: Number(process.env.OBS_DAILY_ROLLUP_INTERVAL_MS ?? "86400000"),
    AI_CREDITS_PER_1K_TOKENS: Number(process.env.AI_CREDITS_PER_1K_TOKENS ?? "10"),
    AI_MULTIPLIER_OPENAI: Number(process.env.AI_MULTIPLIER_OPENAI ?? "1.0"),
    AI_MULTIPLIER_OPENROUTER: Number(process.env.AI_MULTIPLIER_OPENROUTER ?? "1.0"),
    AI_MULTIPLIER_GEMINI: Number(process.env.AI_MULTIPLIER_GEMINI ?? "0.8"),
    AI_MULTIPLIER_CLAUDE: Number(process.env.AI_MULTIPLIER_CLAUDE ?? "1.2"),
    AI_MULTIPLIER_GROK: Number(process.env.AI_MULTIPLIER_GROK ?? "1.5"),
    AI_CREDIT_DRAIN_ALERT_THRESHOLD: Number(process.env.AI_CREDIT_DRAIN_ALERT_THRESHOLD ?? "250"),
    AI_PROMPT_COST_USD_PER_1K: Number(process.env.AI_PROMPT_COST_USD_PER_1K ?? "0.001"),
    AI_COMPLETION_COST_USD_PER_1K: Number(process.env.AI_COMPLETION_COST_USD_PER_1K ?? "0.002"),
    AI_CREDITS_PER_USD: Number(process.env.AI_CREDITS_PER_USD ?? "100"),
    STRIPE_API_KEY: process.env.STRIPE_API_KEY ?? "",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ?? "",
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ?? "",
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
    SUBSCRIPTION_RECONCILIATION_ENABLED: (process.env.SUBSCRIPTION_RECONCILIATION_ENABLED ?? "1").trim() === "1",
    SUBSCRIPTION_RECONCILIATION_INTERVAL_MS: Number(process.env.SUBSCRIPTION_RECONCILIATION_INTERVAL_MS ?? "86400000"),
    SUBSCRIPTION_RECONCILIATION_BATCH_SIZE: Number(process.env.SUBSCRIPTION_RECONCILIATION_BATCH_SIZE ?? "100"),
    ADMIN_IP_ALLOWLIST_ENABLED: (process.env.ADMIN_IP_ALLOWLIST_ENABLED ?? "0").trim() === "1",
    ADMIN_IP_ALLOWLIST: process.env.ADMIN_IP_ALLOWLIST ?? "",
    ADMIN_STEPUP_REQUIRED: (process.env.ADMIN_STEPUP_REQUIRED ?? "1").trim() === "1",
    ADMIN_STEPUP_TTL_MS: Number(process.env.ADMIN_STEPUP_TTL_MS ?? "600000"),
    SECURITY_AUDIT_VERIFY_ENABLED: (process.env.SECURITY_AUDIT_VERIFY_ENABLED ?? "1").trim() === "1",
    SECURITY_AUDIT_VERIFY_INTERVAL_MS: Number(process.env.SECURITY_AUDIT_VERIFY_INTERVAL_MS ?? "21600000"),
    MESSAGE_KEK_B64,
    MESSAGE_KEK_ID,
    MESSAGE_KEK_MAP_JSON: process.env.MESSAGE_KEK_MAP_JSON ?? "",
    MESSAGE_KEK_MAP,
    HEALTH_TOKEN: required("HEALTH_TOKEN"),
    ENFORCE_HTTPS: (process.env.ENFORCE_HTTPS ?? "0").trim() === "1",
    HTTPS_REDIRECT_CODE: Number(process.env.HTTPS_REDIRECT_CODE ?? "308"),
    TRUST_PROXY: (process.env.TRUST_PROXY ?? "1").trim() === "1",
    SECURITY_STRICT_MODE: (process.env.SECURITY_STRICT_MODE ??
        ((process.env.NODE_ENV ?? "development") === "production" ? "1" : "0")) === "1",
    SECURITY_STARTUP_DIAGNOSTICS: (process.env.SECURITY_STARTUP_DIAGNOSTICS ?? "1").trim() === "1",
};
if (exports.env.NODE_ENV === "production" && exports.env.SECURITY_STRICT_MODE) {
    if (exports.env.CORS_ORIGIN === "*") {
        throw new Error("CORS_ORIGIN must not be '*' in production");
    }
    if (!startsWithAny(exports.env.CORS_ORIGIN, ["https://"])) {
        throw new Error("CORS_ORIGIN must use HTTPS in production");
    }
    if (!exports.env.ENFORCE_HTTPS) {
        throw new Error("ENFORCE_HTTPS must be enabled in production");
    }
    if (!exports.env.TRUST_PROXY) {
        throw new Error("TRUST_PROXY must be enabled when HTTPS is enforced in production");
    }
    if (![301, 302, 307, 308].includes(exports.env.HTTPS_REDIRECT_CODE)) {
        throw new Error("HTTPS_REDIRECT_CODE must be one of: 301, 302, 307, 308");
    }
    if (exports.env.JWT_SECRET === "change-me") {
        throw new Error("JWT_SECRET must be set to a strong value in production");
    }
    if (exports.env.AUDIT_SIGNING_SECRET === "change-audit-secret") {
        throw new Error("AUDIT_SIGNING_SECRET must be set to a strong value in production");
    }
    requireStrongInProduction("JWT_SECRET");
    requireStrongInProduction("AUDIT_SIGNING_SECRET");
    requireStrongInProduction("HEALTH_TOKEN");
    requireStrongInProduction("MESSAGE_KEK_B64");
    if (!exports.env.REDIS_REQUIRED) {
        throw new Error("REDIS_REQUIRED must be enabled in production");
    }
    if (!exports.env.ADMIN_STEPUP_REQUIRED) {
        throw new Error("ADMIN_STEPUP_REQUIRED must be enabled in production");
    }
    if (!exports.env.SECURITY_AUDIT_VERIFY_ENABLED) {
        throw new Error("SECURITY_AUDIT_VERIFY_ENABLED must be enabled in production");
    }
    if (exports.env.STRIPE_API_KEY && !exports.env.STRIPE_WEBHOOK_SECRET) {
        throw new Error("STRIPE_WEBHOOK_SECRET is required when STRIPE_API_KEY is configured");
    }
    if ((exports.env.RAZORPAY_KEY_ID || exports.env.RAZORPAY_KEY_SECRET) && !exports.env.RAZORPAY_WEBHOOK_SECRET) {
        throw new Error("RAZORPAY_WEBHOOK_SECRET is required when Razorpay credentials are configured");
    }
    if (exports.env.CALLING_ENABLED) {
        if (!exports.env.LIVEKIT_URL || !startsWithAny(exports.env.LIVEKIT_URL, ["wss://"])) {
            throw new Error("LIVEKIT_URL must use wss:// in production when CALLING_ENABLED=1");
        }
        if (!exports.env.LIVEKIT_API_KEY || !exports.env.LIVEKIT_API_SECRET) {
            throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required in production when CALLING_ENABLED=1");
        }
    }
    if (exports.env.TURN_URL && !startsWithAny(exports.env.TURN_URL, ["turns:"])) {
        throw new Error("TURN_URL must use turns: in production if configured");
    }
    const providerBaseUrls = [
        ["OPENAI_BASE_URL", exports.env.OPENAI_BASE_URL],
        ["OPENROUTER_BASE_URL", exports.env.OPENROUTER_BASE_URL],
        ["ANTHROPIC_BASE_URL", exports.env.ANTHROPIC_BASE_URL],
        ["GEMINI_BASE_URL", exports.env.GEMINI_BASE_URL],
        ["XAI_BASE_URL", exports.env.XAI_BASE_URL],
    ];
    for (const [key, value] of providerBaseUrls) {
        if (value && !startsWithAny(value, ["https://"])) {
            throw new Error(`${key} must use HTTPS in production`);
        }
    }
    const mustNotBePlaceholder = [
        ["JWT_SECRET", exports.env.JWT_SECRET],
        ["AUDIT_SIGNING_SECRET", exports.env.AUDIT_SIGNING_SECRET],
        ["HEALTH_TOKEN", exports.env.HEALTH_TOKEN],
        ["MESSAGE_KEK_B64", exports.env.MESSAGE_KEK_B64],
    ];
    if (exports.env.CALLING_ENABLED) {
        mustNotBePlaceholder.push(["LIVEKIT_URL", exports.env.LIVEKIT_URL], ["LIVEKIT_API_KEY", exports.env.LIVEKIT_API_KEY], ["LIVEKIT_API_SECRET", exports.env.LIVEKIT_API_SECRET]);
    }
    for (const [key, value] of mustNotBePlaceholder) {
        if (isPlaceholderLike(value)) {
            throw new Error(`${key} appears to contain a placeholder value`);
        }
    }
}
