import { env } from "../../config/env";
import { AppError } from "../../middlewares/errorHandler";

type BucketConfig = {
  key: string;
  capacity: number;
  refillPerSec: number;
  consume: number;
};

const ensureRedisConfigured = () => {
  if (!env.REDIS_REST_URL || !env.REDIS_REST_TOKEN) {
    throw new AppError(503, "Redis rate limiter is not configured");
  }
};

const isRedisConfigured = () => Boolean(env.REDIS_REST_URL && env.REDIS_REST_TOKEN);

const redisCall = async (command: string[]) => {
  ensureRedisConfigured();
  const response = await fetch(`${env.REDIS_REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command]),
  });
  if (!response.ok) {
    throw new AppError(503, "Redis rate limiter unavailable");
  }
  const payload = (await response.json()) as Array<{ result?: unknown; error?: string }>;
  const first = payload[0];
  if (first?.error) {
    throw new AppError(503, "Redis command failed", first.error);
  }
  return first?.result;
};

const getBucketState = async (key: string) => {
  const raw = await redisCall(["GET", key]);
  if (!raw || typeof raw !== "string") {
    return null;
  }
  try {
    return JSON.parse(raw) as { tokens: number; lastRefillMs: number };
  } catch {
    return null;
  }
};

const setBucketState = async (key: string, value: { tokens: number; lastRefillMs: number }) => {
  await redisCall(["SET", key, JSON.stringify(value), "EX", "120"]);
};

const consumeBucket = async (input: BucketConfig) => {
  const now = Date.now();
  const current = await getBucketState(input.key);
  const baseTokens = current ? Math.max(0, current.tokens) : input.capacity;
  const baseLastRefillMs = current?.lastRefillMs ?? now;
  const elapsedSec = Math.max(0, (now - baseLastRefillMs) / 1000);
  const refilled = Math.min(
    input.capacity,
    baseTokens + elapsedSec * input.refillPerSec
  );

  if (refilled < input.consume) {
    const missing = input.consume - refilled;
    const retryAfterSec = input.refillPerSec > 0 ? missing / input.refillPerSec : 60;
    await setBucketState(input.key, { tokens: refilled, lastRefillMs: now });
    return {
      allowed: false as const,
      retryAfterMs: Math.ceil(retryAfterSec * 1000),
    };
  }

  const remaining = refilled - input.consume;
  await setBucketState(input.key, { tokens: remaining, lastRefillMs: now });
  return {
    allowed: true as const,
    retryAfterMs: 0,
  };
};

const consumeAiBudgets = async (input: {
  userId: string;
  ip: string;
  estimatedTokens: number;
}) => {
  if (!isRedisConfigured()) {
    if (env.REDIS_REQUIRED) {
      throw new AppError(503, "Redis rate limiter is required but not configured");
    }
    return { allowed: true as const, retryAfterMs: 0 };
  }

  try {
    const userReq = await consumeBucket({
      key: `rl:req:user:${input.userId}`,
      capacity: env.AI_REQ_BUCKET_CAPACITY,
      refillPerSec: env.AI_REQ_BUCKET_REFILL_PER_SEC,
      consume: 1,
    });
    if (!userReq.allowed) return userReq;

    const ipReq = await consumeBucket({
      key: `rl:req:ip:${input.ip}`,
      capacity: env.AI_IP_BUCKET_CAPACITY,
      refillPerSec: env.AI_IP_BUCKET_REFILL_PER_SEC,
      consume: 1,
    });
    if (!ipReq.allowed) return ipReq;

    const tokReq = await consumeBucket({
      key: `rl:tok:user:${input.userId}`,
      capacity: env.AI_TOKEN_BUCKET_CAPACITY,
      refillPerSec: env.AI_TOKEN_BUCKET_REFILL_PER_SEC,
      consume: Math.max(1, input.estimatedTokens),
    });
    return tokReq;
  } catch (error) {
    if (env.REDIS_REQUIRED) throw error;
    return { allowed: true as const, retryAfterMs: 0 };
  }
};

const refundTokenBudget = async (input: { userId: string; tokens: number }) => {
  if (!isRedisConfigured()) return;
  if (!input.userId || input.tokens <= 0) return;
  const key = `rl:tok:user:${input.userId}`;
  const current = await getBucketState(key);
  const next = Math.min(
    env.AI_TOKEN_BUCKET_CAPACITY,
    Math.max(0, current?.tokens ?? 0) + input.tokens
  );
  await setBucketState(key, {
    tokens: next,
    lastRefillMs: Date.now(),
  });
};

const checkRedisReady = async () => {
  if (!isRedisConfigured()) {
    return {
      ok: !env.REDIS_REQUIRED,
      reason: "not_configured",
      required: env.REDIS_REQUIRED,
    };
  }
  try {
    const pong = await redisCall(["PING"]);
    return {
      ok: String(pong ?? "").toUpperCase() === "PONG",
      reason: "ping",
      required: env.REDIS_REQUIRED,
    };
  } catch {
    return {
      ok: false,
      reason: "unreachable",
      required: env.REDIS_REQUIRED,
    };
  }
};

export const redisRateLimiterService = {
  consumeAiBudgets,
  refundTokenBudget,
  checkRedisReady,
};
