"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRateLimit = void 0;
const errorHandler_1 = require("./errorHandler");
const WINDOW_MS = 60000;
const MAX_REQUESTS = 120;
const buckets = new Map();
const adminRateLimit = (req, _res, next) => {
    try {
        const key = req.user?.id ?? req.ip ?? "anonymous";
        const now = Date.now();
        const current = buckets.get(key);
        if (!current || now - current.startedAt > WINDOW_MS) {
            buckets.set(key, { count: 1, startedAt: now });
            return next();
        }
        current.count += 1;
        buckets.set(key, current);
        if (current.count > MAX_REQUESTS) {
            throw new errorHandler_1.AppError(429, "Too many admin requests", { code: "admin-rate-limited" });
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.adminRateLimit = adminRateLimit;
