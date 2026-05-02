"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobsService = void 0;
const prisma_1 = require("../../config/prisma");
const BackgroundJobStatus = {
    PENDING: "PENDING",
    RUNNING: "RUNNING",
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
    DLQ: "DLQ",
};
const isTransientError = (error) => {
    if (!(error instanceof Error))
        return false;
    const text = error.message.toLowerCase();
    if (text.includes("timeout"))
        return true;
    if (text.includes("network"))
        return true;
    if (/\b5\d\d\b/.test(text))
        return true;
    return false;
};
const backoffWithJitterMs = (attempt) => {
    const base = [2000, 5000, 15000, 30000, 60000, 120000];
    const step = base[Math.min(attempt, base.length - 1)];
    const jitter = Math.floor(Math.random() * 750);
    return step + jitter;
};
const enqueueJob = async (input) => {
    return prisma_1.prisma.backgroundJob.upsert({
        where: { jobId: input.jobId },
        create: {
            jobId: input.jobId,
            type: input.type,
            payload: input.payload,
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
    return prisma_1.prisma.backgroundJob.findMany({
        where: { status: BackgroundJobStatus.DLQ },
        orderBy: { updatedAt: "desc" },
        take: Math.min(Math.max(1, limit), 500),
    });
};
const listPendingJobs = async (limit = 100) => {
    return prisma_1.prisma.backgroundJob.findMany({
        where: {
            status: { in: [BackgroundJobStatus.PENDING, BackgroundJobStatus.FAILED] },
        },
        orderBy: { nextRunAt: "asc" },
        take: Math.min(Math.max(1, limit), 500),
    });
};
const retryDlqJob = async (jobId) => {
    return prisma_1.prisma.backgroundJob.update({
        where: { jobId },
        data: {
            status: BackgroundJobStatus.PENDING,
            nextRunAt: new Date(),
            lastError: null,
        },
    });
};
const safeRedact = (payload) => {
    if (!payload || typeof payload !== "object")
        return payload;
    const obj = payload;
    const redacted = {};
    for (const [key, value] of Object.entries(obj)) {
        if (/token|secret|password|key/i.test(key)) {
            redacted[key] = "***REDACTED***";
        }
        else {
            redacted[key] = value;
        }
    }
    return redacted;
};
const getJobDetails = async (jobId) => {
    const job = await prisma_1.prisma.backgroundJob.findUnique({ where: { jobId } });
    if (!job)
        return null;
    return {
        ...job,
        payload: safeRedact(job.payload),
    };
};
const handlers = new Map();
const registerHandler = (type, handler) => {
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
    const dueJob = await prisma_1.prisma.backgroundJob.findFirst({
        where: {
            status: { in: [BackgroundJobStatus.PENDING, BackgroundJobStatus.FAILED] },
            nextRunAt: { lte: now },
        },
        orderBy: { nextRunAt: "asc" },
    });
    if (!dueJob)
        return null;
    const claimed = await prisma_1.prisma.backgroundJob.updateMany({
        where: {
            id: dueJob.id,
            status: { in: [BackgroundJobStatus.PENDING, BackgroundJobStatus.FAILED] },
        },
        data: {
            status: BackgroundJobStatus.RUNNING,
            attempts: { increment: 1 },
        },
    });
    if (claimed.count === 0)
        return null;
    const handler = handlers.get(dueJob.type);
    if (!handler) {
        await prisma_1.prisma.backgroundJob.update({
            where: { id: dueJob.id },
            data: {
                status: BackgroundJobStatus.DLQ,
                lastError: `No handler registered for type: ${dueJob.type}`,
            },
        });
        return dueJob;
    }
    try {
        await handler((dueJob.payload ?? {}), dueJob.jobId);
        await prisma_1.prisma.backgroundJob.update({
            where: { id: dueJob.id },
            data: {
                status: BackgroundJobStatus.SUCCESS,
                completedAt: new Date(),
                lastError: null,
            },
        });
    }
    catch (error) {
        const transient = isTransientError(error);
        const nextAttempt = dueJob.attempts + 1;
        const canRetry = transient && nextAttempt < dueJob.maxAttempts;
        await prisma_1.prisma.backgroundJob.update({
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
let workerInterval = null;
const startJobsWorker = () => {
    if (workerInterval)
        return;
    workerInterval = setInterval(() => {
        void processOneDueJob();
    }, 1000);
};
exports.jobsService = {
    enqueueJob,
    listFailedJobs,
    listPendingJobs,
    retryDlqJob,
    getJobDetails,
    registerHandler,
    processOneDueJob,
    startJobsWorker,
};
