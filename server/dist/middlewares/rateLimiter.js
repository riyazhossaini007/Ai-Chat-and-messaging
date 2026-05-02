"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = void 0;
const WINDOW_MS = 60000;
const LIMIT = 120;
const memoryStore = new Map();
const rateLimiter = (req, res, next) => {
    if (req.path.startsWith("/billing/webhooks/stripe") ||
        req.path.startsWith("/billing/webhooks/razorpay")) {
        return next();
    }
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const current = memoryStore.get(key);
    if (!current || current.resetAt <= now) {
        memoryStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return next();
    }
    current.count += 1;
    memoryStore.set(key, current);
    if (current.count > LIMIT) {
        return res.status(429).json({
            success: false,
            message: "Too many requests, please try again later.",
        });
    }
    return next();
};
exports.rateLimiter = rateLimiter;
