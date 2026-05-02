-- CreateEnum
CREATE TYPE "AiRole" AS ENUM ('USER', 'AI');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "AiJobType" AS ENUM ('GENERAL', 'SUMMARIZE', 'EXPLAIN', 'TRANSLATE');

-- CreateTable
CREATE TABLE "AiThread" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetMessageId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiThread_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "meta" JSONB;

-- CreateTable
CREATE TABLE "AiTurn" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" "AiRole" NOT NULL,
    "content" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiJob" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "type" "AiJobType" NOT NULL,
    "status" "AiJobStatus" NOT NULL DEFAULT 'QUEUED',
    "input" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiThread_chatId_requesterId_createdAt_idx" ON "AiThread"("chatId", "requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "AiThread_targetMessageId_idx" ON "AiThread"("targetMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "AiThread_chatId_requesterId_targetMessageId_key" ON "AiThread"("chatId", "requesterId", "targetMessageId");

-- CreateIndex
CREATE INDEX "AiTurn_threadId_createdAt_idx" ON "AiTurn"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AiJob_threadId_status_createdAt_idx" ON "AiJob"("threadId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AiJob_requesterId_status_createdAt_idx" ON "AiJob"("requesterId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "AiThread" ADD CONSTRAINT "AiThread_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiThread" ADD CONSTRAINT "AiThread_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiThread" ADD CONSTRAINT "AiThread_targetMessageId_fkey" FOREIGN KEY ("targetMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTurn" ADD CONSTRAINT "AiTurn_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AiThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiJob" ADD CONSTRAINT "AiJob_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AiThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiJob" ADD CONSTRAINT "AiJob_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
