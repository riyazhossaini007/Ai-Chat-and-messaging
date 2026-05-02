import { NextFunction, Request, Response } from "express";

const WINDOW_MS = 60_000;
const LIMIT = 120;
const memoryStore = new Map<string, { count: number; resetAt: number }>();

export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (
    req.path.startsWith("/billing/webhooks/stripe") ||
    req.path.startsWith("/billing/webhooks/razorpay")
  ) {
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
