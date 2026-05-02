-- CreateTable
CREATE TABLE "AdminStepUpChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sessionTokenHash" TEXT,
    "sessionExpiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminStepUpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActionAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "previousHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminActionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminStepUpChallenge_userId_createdAt_idx" ON "AdminStepUpChallenge"("userId", "createdAt");
CREATE INDEX "AdminStepUpChallenge_expiresAt_sessionExpiresAt_idx" ON "AdminStepUpChallenge"("expiresAt", "sessionExpiresAt");
CREATE UNIQUE INDEX "AdminActionAuditLog_hash_key" ON "AdminActionAuditLog"("hash");
CREATE INDEX "AdminActionAuditLog_actorUserId_createdAt_idx" ON "AdminActionAuditLog"("actorUserId", "createdAt");
CREATE INDEX "AdminActionAuditLog_targetUserId_createdAt_idx" ON "AdminActionAuditLog"("targetUserId", "createdAt");
CREATE INDEX "AdminActionAuditLog_action_createdAt_idx" ON "AdminActionAuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminStepUpChallenge" ADD CONSTRAINT "AdminStepUpChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminActionAuditLog" ADD CONSTRAINT "AdminActionAuditLog_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminActionAuditLog" ADD CONSTRAINT "AdminActionAuditLog_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
