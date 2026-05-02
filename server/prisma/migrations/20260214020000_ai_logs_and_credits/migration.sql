-- CreateEnum
CREATE TYPE "AiRequestStatus" AS ENUM ('RUNNING', 'OK', 'ERROR', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreditLedgerType" AS ENUM ('AI_USAGE', 'MANUAL_ADJUSTMENT', 'PURCHASE', 'REFUND');

-- CreateTable
CREATE TABLE "AiRequestLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "isStream" BOOLEAN NOT NULL DEFAULT false,
    "temperature" DOUBLE PRECISION,
    "maxTokens" INTEGER,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costCredits" INTEGER NOT NULL DEFAULT 0,
    "status" "AiRequestStatus" NOT NULL DEFAULT 'RUNNING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCreditWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balanceCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCreditWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "requestId" TEXT,
    "type" "CreditLedgerType" NOT NULL,
    "deltaCredits" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiRequestLog_userId_startedAt_idx" ON "AiRequestLog"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "AiRequestLog_status_startedAt_idx" ON "AiRequestLog"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserCreditWallet_userId_key" ON "UserCreditWallet"("userId");

-- CreateIndex
CREATE INDEX "UserCreditWallet_userId_idx" ON "UserCreditWallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedger_requestId_key" ON "CreditLedger"("requestId");

-- CreateIndex
CREATE INDEX "CreditLedger_userId_createdAt_idx" ON "CreditLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditLedger_walletId_createdAt_idx" ON "CreditLedger"("walletId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiRequestLog" ADD CONSTRAINT "AiRequestLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCreditWallet" ADD CONSTRAINT "UserCreditWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserCreditWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AiRequestLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
