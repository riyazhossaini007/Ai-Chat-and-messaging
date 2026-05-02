-- AlterEnum
ALTER TYPE "CreditLedgerType" ADD VALUE IF NOT EXISTS 'DEBIT';
ALTER TYPE "CreditLedgerType" ADD VALUE IF NOT EXISTS 'CREDIT';

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'PAST_DUE');

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('STRIPE', 'RAZORPAY', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('OK', 'MISMATCH', 'ADJUSTED');

-- AlterTable
ALTER TABLE "AiRequestLog"
ADD COLUMN "requestId" TEXT,
ADD COLUMN "chatId" TEXT,
ADD COLUMN "providerModelId" TEXT,
ADD COLUMN "estimatorUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "streamStartedAt" TIMESTAMP(3),
ADD COLUMN "firstTokenAt" TIMESTAMP(3),
ADD COLUMN "lastTokenAt" TIMESTAMP(3),
ADD COLUMN "streamCompletedAt" TIMESTAMP(3);

UPDATE "AiRequestLog" SET "requestId" = "id" WHERE "requestId" IS NULL;
ALTER TABLE "AiRequestLog" ALTER COLUMN "requestId" SET NOT NULL;
CREATE UNIQUE INDEX "AiRequestLog_requestId_key" ON "AiRequestLog"("requestId");
CREATE INDEX "AiRequestLog_requestId_userId_idx" ON "AiRequestLog"("requestId", "userId");

-- AlterTable
ALTER TABLE "CreditLedger"
ADD COLUMN "aiRequestLogId" TEXT,
ADD COLUMN "tokens" INTEGER,
ADD COLUMN "creditsAmount" INTEGER,
ADD COLUMN "provider" TEXT,
ADD COLUMN "model" TEXT;

UPDATE "CreditLedger" c
SET "aiRequestLogId" = a."id"
FROM "AiRequestLog" a
WHERE c."requestId" IS NOT NULL AND a."id" = c."requestId";

ALTER TABLE "CreditLedger" DROP CONSTRAINT IF EXISTS "CreditLedger_requestId_fkey";
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_aiRequestLogId_fkey"
FOREIGN KEY ("aiRequestLogId") REFERENCES "AiRequestLog"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "CreditLedger_requestId_key";
CREATE UNIQUE INDEX "CreditLedger_requestId_key" ON "CreditLedger"("requestId");
CREATE INDEX "CreditLedger_requestId_idx" ON "CreditLedger"("requestId");

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthly" DOUBLE PRECISION NOT NULL,
    "creditAllowance" INTEGER NOT NULL,
    "modelAccess" JSONB NOT NULL,
    "maxTokensPerMonth" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "billingProvider" "BillingProvider" NOT NULL,
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTopUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditsPurchased" INTEGER NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingProvider" "BillingProvider" NOT NULL,
    "providerPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageReconciliation" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storedTokens" INTEGER NOT NULL,
    "providerTokens" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "status" "ReconciliationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscription_userId_status_currentPeriodEnd_idx" ON "Subscription"("userId", "status", "currentPeriodEnd");
CREATE INDEX "CreditTopUp_userId_createdAt_idx" ON "CreditTopUp"("userId", "createdAt");
CREATE INDEX "UsageReconciliation_requestId_createdAt_idx" ON "UsageReconciliation"("requestId", "createdAt");
CREATE INDEX "UsageReconciliation_status_createdAt_idx" ON "UsageReconciliation"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditTopUp" ADD CONSTRAINT "CreditTopUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageReconciliation" ADD CONSTRAINT "UsageReconciliation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageReconciliation" ADD CONSTRAINT "UsageReconciliation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AiRequestLog"("requestId") ON DELETE CASCADE ON UPDATE CASCADE;

