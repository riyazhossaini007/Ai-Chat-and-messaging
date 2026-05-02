import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

type JobPayload = Record<string, unknown>;
const BackgroundJobStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  DLQ: "DLQ",
} as const;

const isTransientError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const text = error.message.toLowerCase();
  if (text.includes("timeout")) return true;
  if (text.includes("network")) return true;
  if (/\b5\d\d\b/.test(text)) return true;
  return false;
};

const backoffWithJitterMs = (attempt: number) => {
  const base = [2000, 5000, 15000, 30000, 60000, 120000];
  const step = base[Math.min(attempt, base.length - 1)];
  const jitter = Math.floor(Math.random() * 750);
  return step + jitter;
};

const enqueueJob = async (input: {
  jobId: string;
  type: string;
  payload: JobPayload;
  userId?: string;
  requestId?: string;
  attempts?: number;
  scheduledAt?: Date;
}) => {
  return (prisma as any).backgroundJob.upsert({
    where: { jobId: input.jobId },
    create: {
      jobId: input.jobId,
      type: input.type,
      payload: input.payload as Prisma.InputJsonValue,
      userId: input.userId,
      requestId: input.requestId,
      maxAttempts: Math.min(Math.max(1, input.attempts ?? 6), 8),
      scheduledAt: input.scheduledAt ?? new Date(),
      nextRunAt: input.scheduledAt ?? new Date(),
    },
    update: {},
  });
};

const listFailedJobs = async (limit = 100) => {
  return (prisma as any).backgroundJob.findMany({
    where: { status: BackgroundJobStatus.DLQ },
    orderBy: { updatedAt: "desc" },
    take: Math.min(Math.max(1, limit), 500),
  });
};

const listPendingJobs = async (limit = 100) => {
  return (prisma as any).backgroundJob.findMany({
    where: {
      status: { in: [BackgroundJobStatus.PENDING, BackgroundJobStatus.FAILED] },
    },
    orderBy: { nextRunAt: "asc" },
    take: Math.min(Math.max(1, limit), 500),
  });
};

const retryDlqJob = async (jobId: string) => {
  return (prisma as any).backgroundJob.update({
    where: { jobId },
    data: {
      status: BackgroundJobStatus.PENDING,
      nextRunAt: new Date(),
      lastError: null,
    },
  });
};

const safeRedact = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return payload;
  const obj = payload as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (/token|secret|password|key/i.test(key)) {
      redacted[key] = "***REDACTED***";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
};

const getJobDetails = async (jobId: string) => {
  const job = await (prisma as any).backgroundJob.findUnique({ where: { jobId } });
  if (!job) return null;
  return {
    ...job,
    payload: safeRedact(job.payload),
  };
};

type JobHandler = (payload: JobPayload, jobId: string) => Promise<void>;
const handlers = new Map<string, JobHandler>();

const registerHandler = (type: string, handler: JobHandler) => {
  handlers.set(type, handler);
};

registerHandler("reconciliation_hourly", async () => undefined);
registerHandler("reconciliation_daily", async () => undefined);
registerHandler("webhook_process", async () => undefined);
registerHandler("deferred_summary", async () => undefined);
registerHandler("moderation_scan", async () => undefined);
registerHandler("index_document", async () => undefined);

const processOneDueJob = async () => {
  const now = new Date();
  const dueJob = await (prisma as any).backgroundJob.findFirst({
    where: {
      status: { in: [BackgroundJobStatus.PENDING, BackgroundJobStatus.FAILED] },
      nextRunAt: { lte: now },
    },
    orderBy: { nextRunAt: "asc" },
  });
  if (!dueJob) return null;

  const claimed = await (prisma as any).backgroundJob.updateMany({
    where: {
      id: dueJob.id,
      status: { in: [BackgroundJobStatus.PENDING, BackgroundJobStatus.FAILED] },
    },
    data: {
      status: BackgroundJobStatus.RUNNING,
      attempts: { increment: 1 },
    },
  });
  if (claimed.count === 0) return null;

  const handler = handlers.get(dueJob.type);
  if (!handler) {
    await (prisma as any).backgroundJob.update({
      where: { id: dueJob.id },
      data: {
        status: BackgroundJobStatus.DLQ,
        lastError: `No handler registered for type: ${dueJob.type}`,
      },
    });
    return dueJob;
  }

  try {
    await handler((dueJob.payload ?? {}) as JobPayload, dueJob.jobId);
    await (prisma as any).backgroundJob.update({
      where: { id: dueJob.id },
      data: {
        status: BackgroundJobStatus.SUCCESS,
        completedAt: new Date(),
        lastError: null,
      },
    });
  } catch (error) {
    const transient = isTransientError(error);
    const nextAttempt = dueJob.attempts + 1;
    const canRetry = transient && nextAttempt < dueJob.maxAttempts;
    await (prisma as any).backgroundJob.update({
      where: { id: dueJob.id },
      data: {
        status: canRetry ? BackgroundJobStatus.FAILED : BackgroundJobStatus.DLQ,
        nextRunAt: canRetry ? new Date(Date.now() + backoffWithJitterMs(nextAttempt)) : dueJob.nextRunAt,
        lastError: error instanceof Error ? error.message.slice(0, 1000) : "Job failed",
      },
    });
  }

  return dueJob;
};

let workerInterval: NodeJS.Timeout | null = null;
const startJobsWorker = () => {
  if (workerInterval) return;
  workerInterval = setInterval(() => {
    void processOneDueJob();
  }, 1000);
};

export const jobsService = {
  enqueueJob,
  listFailedJobs,
  listPendingJobs,
  retryDlqJob,
  getJobDetails,
  registerHandler,
  processOneDueJob,
  startJobsWorker,
};
