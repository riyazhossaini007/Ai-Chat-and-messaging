-- CreateEnum
CREATE TYPE "ProviderHealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN');

-- CreateEnum
CREATE TYPE "CircuitBreakerState" AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');

-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'DLQ');

-- CreateTable
CREATE TABLE "AiProviderHealth" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "ProviderHealthStatus" NOT NULL DEFAULT 'HEALTHY',
    "breakerState" "CircuitBreakerState" NOT NULL DEFAULT 'CLOSED',
    "lastCheckedAt" TIMESTAMP(3),
    "rollingLatencyP50Ms" INTEGER,
    "rollingLatencyP95Ms" INTEGER,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeoutRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "consecutiveSuccesses" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowRequestCount" INTEGER NOT NULL DEFAULT 0,
    "windowErrorCount" INTEGER NOT NULL DEFAULT 0,
    "windowTimeoutCount" INTEGER NOT NULL DEFAULT 0,
    "latencySamples" JSONB,
    "openUntil" TIMESTAMP(3),
    "halfOpenTrialCount" INTEGER NOT NULL DEFAULT 0,
    "halfOpenSuccessCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiProviderHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT,
    "requestId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiProviderHealth_provider_key" ON "AiProviderHealth"("provider");
CREATE UNIQUE INDEX "BackgroundJob_jobId_key" ON "BackgroundJob"("jobId");
CREATE INDEX "BackgroundJob_status_nextRunAt_idx" ON "BackgroundJob"("status", "nextRunAt");

