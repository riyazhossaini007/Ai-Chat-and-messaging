-- CreateEnum
CREATE TYPE "UserAccountStatus" AS ENUM ('ACTIVE', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'FROZEN', 'DELETED');

-- CreateEnum
CREATE TYPE "EntitlementFeatureKey" AS ENUM ('PRO_ACCESS', 'AI_UNLIMITED', 'CALLING', 'GROUP_CALLING', 'NO_ADS');

-- CreateEnum
CREATE TYPE "AiUsageProvider" AS ENUM ('OPENAI', 'OPENROUTER');

-- CreateEnum
CREATE TYPE "AiUsageEventStatus" AS ENUM ('OK', 'ERROR');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'MESSAGE', 'GROUP', 'CALL');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CallJoinMethod" AS ENUM ('INVITE', 'JOIN');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "role" "AppRole" NOT NULL DEFAULT 'USER',
ADD COLUMN "status" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "lastActiveAt" TIMESTAMP(3),
ADD COLUMN "adminNote" TEXT;

-- Backfill user role from existing RBAC assignments (highest role wins)
UPDATE "User" u SET "role" = sub."name"::"AppRole"
FROM (
  SELECT DISTINCT ON (ur."userId")
    ur."userId",
    r."name"
  FROM "UserRole" ur
  JOIN "Role" r ON r."id" = ur."roleId"
  ORDER BY ur."userId",
    CASE r."name"
      WHEN 'SUPERADMIN' THEN 4
      WHEN 'ADMIN' THEN 3
      WHEN 'MODERATOR' THEN 2
      ELSE 1
    END DESC
) sub
WHERE u."id" = sub."userId";

-- AlterTable
ALTER TABLE "Group"
ADD COLUMN "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "CallSession"
ADD COLUMN "connectedAt" TIMESTAMP(3),
ADD COLUMN "durationSec" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "failureReason" TEXT,
ADD COLUMN "region" TEXT,
ADD COLUMN "meta" JSONB;

-- AlterTable
ALTER TABLE "CallParticipant"
ADD COLUMN "joinMethod" "CallJoinMethod" NOT NULL DEFAULT 'INVITE';

-- CreateTable
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "meta" JSONB,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "featureKey" "EntitlementFeatureKey" NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "isRevoked" BOOLEAN NOT NULL DEFAULT false,
  "grantedByUserId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT,
  CONSTRAINT "EntitlementGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "modelProvider" "AiUsageProvider" NOT NULL,
  "modelName" TEXT NOT NULL,
  "tokensIn" INTEGER NOT NULL DEFAULT 0,
  "tokensOut" INTEGER NOT NULL DEFAULT 0,
  "costUsd" DOUBLE PRECISION,
  "status" "AiUsageEventStatus" NOT NULL,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
  "id" TEXT NOT NULL,
  "reporterUserId" TEXT NOT NULL,
  "targetType" "ReportTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "description" TEXT,
  "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "resolutionNote" TEXT,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

CREATE INDEX "EntitlementGrant_userId_featureKey_isRevoked_expiresAt_idx"
ON "EntitlementGrant"("userId", "featureKey", "isRevoked", "expiresAt");
CREATE INDEX "EntitlementGrant_featureKey_isRevoked_expiresAt_idx"
ON "EntitlementGrant"("featureKey", "isRevoked", "expiresAt");
CREATE INDEX "EntitlementGrant_grantedByUserId_createdAt_idx"
ON "EntitlementGrant"("grantedByUserId", "createdAt");

CREATE INDEX "AiUsageEvent_createdAt_idx" ON "AiUsageEvent"("createdAt");
CREATE INDEX "AiUsageEvent_userId_createdAt_idx" ON "AiUsageEvent"("userId", "createdAt");
CREATE INDEX "AiUsageEvent_modelProvider_createdAt_idx" ON "AiUsageEvent"("modelProvider", "createdAt");

CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");
CREATE INDEX "Report_reporterUserId_createdAt_idx" ON "Report"("reporterUserId", "createdAt");

-- Foreign Keys
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_grantedByUserId_fkey"
FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_revokedByUserId_fkey"
FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterUserId_fkey"
FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedByUserId_fkey"
FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

