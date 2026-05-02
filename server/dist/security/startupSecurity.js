"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logStartupSecurityDiagnostics = exports.buildStartupSecurityChecks = void 0;
const env_1 = require("../config/env");
const pushCheck = (checks, name, pass, ok, warn) => {
    checks.push({
        name,
        level: pass ? "ok" : "warn",
        detail: pass ? ok : warn,
    });
};
const truthy = (value) => value.trim().length > 0;
const buildStartupSecurityChecks = () => {
    const checks = [];
    pushCheck(checks, "https_enforcement", env_1.env.ENFORCE_HTTPS, "HTTPS enforcement is enabled", "HTTPS enforcement is disabled");
    pushCheck(checks, "trust_proxy", env_1.env.TRUST_PROXY, "trust proxy is enabled", "trust proxy is disabled (may break HTTPS detection behind a proxy)");
    pushCheck(checks, "cors_origin", env_1.env.CORS_ORIGIN !== "*", `CORS origin is restricted to '${env_1.env.CORS_ORIGIN}'`, "CORS origin allows '*'");
    pushCheck(checks, "jwt_secret_length", env_1.env.JWT_SECRET.length >= 32 && env_1.env.JWT_SECRET !== "change-me", "JWT secret length looks strong", "JWT secret looks weak/default");
    pushCheck(checks, "audit_signing_secret_length", env_1.env.AUDIT_SIGNING_SECRET.length >= 32 && env_1.env.AUDIT_SIGNING_SECRET !== "change-audit-secret", "Audit signing secret looks strong", "Audit signing secret looks weak/default");
    pushCheck(checks, "health_token_length", env_1.env.HEALTH_TOKEN.length >= 32, "Health token length looks strong", "Health token looks short");
    pushCheck(checks, "message_kek_present", truthy(env_1.env.MESSAGE_KEK_B64), "Message KEK is configured", "Message KEK is missing");
    pushCheck(checks, "redis_required", env_1.env.REDIS_REQUIRED, "Redis is required", "Redis is not required");
    pushCheck(checks, "admin_stepup", env_1.env.ADMIN_STEPUP_REQUIRED, "Admin step-up is required", "Admin step-up is disabled");
    pushCheck(checks, "audit_verify_worker", env_1.env.SECURITY_AUDIT_VERIFY_ENABLED, "Security audit verification is enabled", "Security audit verification is disabled");
    if (env_1.env.CALLING_ENABLED) {
        pushCheck(checks, "livekit_url", env_1.env.LIVEKIT_URL.startsWith("wss://"), "LiveKit URL uses WSS", "LiveKit URL does not use WSS");
    }
    return checks;
};
exports.buildStartupSecurityChecks = buildStartupSecurityChecks;
const logStartupSecurityDiagnostics = () => {
    if (!env_1.env.SECURITY_STARTUP_DIAGNOSTICS)
        return;
    const checks = (0, exports.buildStartupSecurityChecks)();
    const warnings = checks.filter((item) => item.level === "warn").length;
    const summary = warnings === 0 ? "all security diagnostics passed" : `${warnings} warning(s) detected`;
    console.log("[security-startup] profile", {
        nodeEnv: env_1.env.NODE_ENV,
        strictMode: env_1.env.SECURITY_STRICT_MODE,
        summary,
    });
    for (const check of checks) {
        console.log(`[security-startup] ${check.level.toUpperCase()} ${check.name}: ${check.detail}`);
    }
};
exports.logStartupSecurityDiagnostics = logStartupSecurityDiagnostics;
