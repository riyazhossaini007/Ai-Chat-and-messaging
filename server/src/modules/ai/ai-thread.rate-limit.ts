import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/errorHandler";

const PER_MINUTE_LIMIT = 10;
const FREE_DAILY_CAP = 200;
const minuteState = new Map<string, { count: number; windowStartedAtMs: number }>();

const getUtcDayBounds = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

const consumePerMinute = (userId: string) => {
  const key = userId;
  const now = Date.now();
  const current = minuteState.get(key);
  if (!current || now - current.windowStartedAtMs >= 60_000) {
    minuteState.set(key, { count: 1, windowStartedAtMs: now });
    return;
  }
  if (current.count >= PER_MINUTE_LIMIT) {
    const retryAfterMs = Math.max(500, 60_000 - (now - current.windowStartedAtMs));
    throw new AppError(429, "Too many AI requests. Try again soon.", {
      error: "RATE_LIMITED",
      retryAfterMs,
    });
  }
  current.count += 1;
  minuteState.set(key, current);
};

export const enforceAiThreadRateLimit = async (input: {
  requesterId: string;
  subscriptionActive: boolean;
}) => {
  consumePerMinute(input.requesterId);
  if (input.subscriptionActive) return;

  const { start, end } = getUtcDayBounds();
  const prismaAny = prisma as any;
  const usageToday = await prismaAny.aiJob.count({
    where: {
      requesterId: input.requesterId,
      createdAt: {
        gte: start,
        lt: end,
      },
    },
  });
  if (usageToday >= FREE_DAILY_CAP) {
    throw new AppError(402, "Daily free AI cap reached. Upgrade to continue.", {
      error: "FREE_DAILY_CAP_REACHED",
      dailyCap: FREE_DAILY_CAP,
    });
  }
};

