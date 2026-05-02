-- AlterEnum
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'PAYWALL_BLOCK';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'CIRCUIT_OPEN';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'PROVIDER_DOWN';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'BILLING_ANOMALY';

-- CreateEnum
CREATE TYPE "OpsAlertType" AS ENUM (
  'SPEND_SPIKE',
  'ERROR_SPIKE',
  'PROVIDER_DOWNTIME',
  'BILLING_ANOMALY',
  'ESTIMATOR_SPIKE'
);

-- CreateEnum
CREATE TYPE "OpsAlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "OpsAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- AlterTable
ALTER TABLE "AiRequestLog"
ADD COLUMN "traceId" TEXT,
ADD COLUMN "latencyMs" INTEGER,
ADD COLUMN "ttftMs" INTEGER,
ADD COLUMN "streamDurationMs" INTEGER,
ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "isRegeneration" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "regeneratedFromRequestId" TEXT;

-- CreateTable
CREATE TABLE "ProviderPricing" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputUsdPer1M" DOUBLE PRECISION NOT NULL,
    "outputUsdPer1M" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "pricingVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAiCost" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditsCharged" INTEGER NOT NULL DEFAULT 0,
    "refunds" INTEGER NOT NULL DEFAULT 0,
    "paywallBlocks" INTEGER NOT NULL DEFAULT 0,
    "regenCount" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "p95LatencyMs" INTEGER NOT NULL DEFAULT 0,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenueUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyAiCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsAlert" (
    "id" TEXT NOT NULL,
    "type" "OpsAlertType" NOT NULL,
    "severity" "OpsAlertSeverity" NOT NULL,
    "status" "OpsAlertStatus" NOT NULL DEFAULT 'OPEN',
    "dedupeKey" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "details" JSONB,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OpsAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderPricing_provider_model_effectiveFrom_key" ON "ProviderPricing"("provider", "model", "effectiveFrom");
CREATE INDEX "ProviderPricing_provider_model_effectiveFrom_idx" ON "ProviderPricing"("provider", "model", "effectiveFrom");
CREATE UNIQUE INDEX "DailyAiCost_date_provider_model_key" ON "DailyAiCost"("date", "provider", "model");
CREATE INDEX "DailyAiCost_date_provider_model_idx" ON "DailyAiCost"("date", "provider", "model");
CREATE UNIQUE INDEX "OpsAlert_dedupeKey_key" ON "OpsAlert"("dedupeKey");
CREATE INDEX "OpsAlert_type_status_createdAt_idx" ON "OpsAlert"("type", "status", "createdAt");
CREATE INDEX "OpsAlert_provider_model_createdAt_idx" ON "OpsAlert"("provider", "model", "createdAt");
