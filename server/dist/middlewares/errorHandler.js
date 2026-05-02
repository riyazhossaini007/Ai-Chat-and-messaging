"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFoundHandler = exports.AppError = void 0;
class AppError extends Error {
    constructor(statusCode, message, details, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code ?? (typeof details?.code === "string"
            ? String(details.code)
            : undefined);
        this.details = details;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
const SENSITIVE_KEYS = new Set([
    "message_kek_b64",
    "message_kek_id",
    "dekwrapped",
    "ciphertext",
    "iv",
    "authtag",
    "password",
    "passwordhash",
    "token",
    "secret",
    "authorization",
]);
const redactSensitive = (input) => {
    if (input === null || input === undefined)
        return input;
    if (typeof input !== "object")
        return input;
    if (Array.isArray(input))
        return input.map(redactSensitive);
    const out = {};
    for (const [key, value] of Object.entries(input)) {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
            out[key] = "[REDACTED]";
            continue;
        }
        out[key] = redactSensitive(value);
    }
    return out;
};
const notFoundHandler = (_req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
};
exports.notFoundHandler = notFoundHandler;
const errorHandler = (err, _req, res, _next) => {
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const message = err instanceof Error ? err.message : "Internal server error";
    const code = err instanceof AppError ? err.code : undefined;
    const details = err instanceof AppError ? redactSensitive(err.details) : undefined;
    res.status(statusCode).json({
        success: false,
        ...(code ? { code } : {}),
        message,
        details,
    });
};
exports.errorHandler = errorHandler;
