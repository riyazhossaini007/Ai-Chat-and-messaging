"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisRateLimiterService = void 0;
const env_1 = require("../../config/env");
const errorHandler_1 = require("../../middlewares/errorHandler");
const ensureRedisConfigured = () => {
    if (!env_1.env.REDIS_REST_URL || !env_1.env.REDIS_REST_TOKEN) {
        throw new errorHandler_1.AppError(503, "Redis rate limiter is not configured");
    }
};
const isRedisConfigured = () => Boolean(env_1.env.REDIS_REST_URL && env_1.env.REDIS_REST_TOKEN);
const redisCall = async (command) => {
    ensureRedisConfigured();
    const response = await fetch(`${env_1.env.REDIS_REST_URL}/pipeline`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env_1.env.REDIS_REST_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify([command]),
    });
    if (!response.ok) {
        throw new errorHandler_1.AppError(503, "Redis rate limiter unavailable");
    }
    const payload = (await response.json());
    const first = payload[0];
    if (first?.error) {
        throw new errorHandler_1.AppError(503, "Redis command failed", first.error);
    }
    return first?.result;
};
const getBucketState = async (key) => {
    const raw = await redisCall(["GET", key]);
    if (!raw || typeof raw !== "string") {
        return null;
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
};
const setBucketState = async (key, value) => {
    await redisCall(["SET", key, JSON.stringify(value), "EX", "120"]);
};
const consumeBucket = async (input) => {
    const now = Date.now();
    const current = await getBucketState(input.key);
    const baseTokens = current ? Math.max(0, current.tokens) : input.capacity;
    const baseLastRefillMs = current?.lastRefillMs ?? now;
    const elapsedSec = Math.max(0, (now - baseLastRefillMs) / 1000);
    const refilled = Math.min(input.capacity, baseTokens + elapsedSec * input.refillPerSec);
    if (refilled < input.consume) {
        const missing = input.consume - refilled;
        const retryAfterSec = input.refillPerSec > 0 ? missing / input.refillPerSec : 60;
        await setBucketState(input.key, { tokens: refilled, lastRefillMs: now });
        return {
            allowed: false,
            retryAfterMs: Math.ceil(retryAfterSec * 1000),
        };
    }
    const remaining = refilled - input.consume;
    await setBucketState(input.key, { tokens: remaining, lastRefillMs: now });
    return {
        allowed: true,
        retryAfterMs: 0,
    };
};
const consumeAiBudgets = async (input) => {
    if (!isRedisConfigured()) {
        if (env_1.env.REDIS_REQUIRED) {
            throw new errorHandler_1.AppError(503, "Redis rate limiter is required but not configured");
        }
        return { allowed: true, retryAfterMs: 0 };
    }
    try {
        const userReq = await consumeBucket({
            key: `rl:req:user:${input.userId}`,
            capacity: env_1.env.AI_REQ_BUCKET_CAPACITY,
            refillPerSec: env_1.env.AI_REQ_BUCKET_REFILL_PER_SEC,
            consume: 1,
        });
        if (!userReq.allowed)
            return userReq;
        const ipReq = await consumeBucket({
            key: `rl:req:ip:${input.ip}`,
            capacity: env_1.env.AI_IP_BUCKET_CAPACITY,
            refillPerSec: env_1.env.AI_IP_BUCKET_REFILL_PER_SEC,
            consume: 1,
        });
        if (!ipReq.allowed)
            return ipReq;
        const tokReq = await consumeBucket({
            key: `rl:tok:user:${input.userId}`,
            capacity: env_1.env.AI_TOKEN_BUCKET_CAPACITY,
            refillPerSec: env_1.env.AI_TOKEN_BUCKET_REFILL_PER_SEC,
            consume: Math.max(1, input.estimatedTokens),
        });
        return tokReq;
    }
    catch (error) {
        if (env_1.env.REDIS_REQUIRED)
            throw error;
        return { allowed: true, retryAfterMs: 0 };
    }
};
const refundTokenBudget = async (input) => {
    if (!isRedisConfigured())
        return;
    if (!input.userId || input.tokens <= 0)
        return;
    const key = `rl:tok:user:${input.userId}`;
    const current = await getBucketState(key);
    const next = Math.min(env_1.env.AI_TOKEN_BUCKET_CAPACITY, Math.max(0, current?.tokens ?? 0) + input.tokens);
    await setBucketState(key, {
        tokens: next,
        lastRefillMs: Date.now(),
    });
};
const checkRedisReady = async () => {
    if (!isRedisConfigured()) {
        return {
            ok: !env_1.env.REDIS_REQUIRED,
            reason: "not_configured",
            required: env_1.env.REDIS_REQUIRED,
        };
    }
    try {
        const pong = await redisCall(["PING"]);
        return {
            ok: String(pong ?? "").toUpperCase() === "PONG",
            reason: "ping",
            required: env_1.env.REDIS_REQUIRED,
        };
    }
    catch {
        return {
            ok: false,
            reason: "unreachable",
            required: env_1.env.REDIS_REQUIRED,
        };
    }
};
exports.redisRateLimiterService = {
    consumeAiBudgets,
    refundTokenBudget,
    checkRedisReady,
};
