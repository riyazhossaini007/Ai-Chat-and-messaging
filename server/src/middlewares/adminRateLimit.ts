import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../types";
import { AppError } from "./errorHandler";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;
const buckets = new Map<string, { count: number; startedAt: number }>();

export const adminRateLimit = (req: AuthRequest, _res: Response, next: NextFunction) => {
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
      throw new AppError(429, "Too many admin requests", { code: "admin-rate-limited" });
    }
    next();
  } catch (error) {
    next(error);
  }
};

