-- Restored migration file for calls feature (guarded for environments where tables may already exist)

DO $$
BEGIN
  CREATE TYPE "CallType" AS ENUM ('VOICE', 'VIDEO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CallStatus" AS ENUM ('idle', 'ringing', 'accepted', 'in_progress', 'ended', 'missed', 'declined', 'failed', 'busy', 'timeout');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CallParticipantRole" AS ENUM ('CALLER', 'CALLEE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CallParticipantStatus" AS ENUM ('ringing', 'accepted', 'declined', 'missed', 'busy', 'ended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "UserSubscriptionStatus" AS ENUM ('active', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SfuProvider" AS ENUM ('NONE', 'LIVEKIT', 'MEDIASOUP');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CallSession" (
  "id" TEXT NOT NULL,
  "type" "CallType" NOT NULL,
  "isGroup" BOOLEAN NOT NULL DEFAULT false,
  "chatId" TEXT,
  "createdBy" TEXT NOT NULL,
  "hostUserId" TEXT NOT NULL,
  "sfuProvider" "SfuProvider" NOT NULL DEFAULT 'NONE',
  "roomName" TEXT,
  "status" "CallStatus" NOT NULL DEFAULT 'ringing',
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CallParticipant" (
  "id" TEXT NOT NULL,
  "callId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "CallParticipantRole" NOT NULL,
  "joinedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  "status" "CallParticipantStatus" NOT NULL DEFAULT 'ringing',
  "deviceInfo" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CallEvent" (
  "id" TEXT NOT NULL,
  "callId" TEXT NOT NULL,
  "userId" TEXT,
  "eventType" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "status" "UserSubscriptionStatus" NOT NULL DEFAULT 'active',
  "validUntil" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CallParticipant_callId_userId_key" ON "CallParticipant"("callId", "userId");
CREATE INDEX IF NOT EXISTS "CallSession_createdBy_createdAt_idx" ON "CallSession"("createdBy", "createdAt");
CREATE INDEX IF NOT EXISTS "CallSession_hostUserId_createdAt_idx" ON "CallSession"("hostUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "CallSession_chatId_createdAt_idx" ON "CallSession"("chatId", "createdAt");
CREATE INDEX IF NOT EXISTS "CallSession_roomName_idx" ON "CallSession"("roomName");
CREATE INDEX IF NOT EXISTS "CallSession_status_createdAt_idx" ON "CallSession"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CallParticipant_userId_createdAt_idx" ON "CallParticipant"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CallParticipant_callId_status_idx" ON "CallParticipant"("callId", "status");
CREATE INDEX IF NOT EXISTS "CallParticipant_userId_leftAt_idx" ON "CallParticipant"("userId", "leftAt");
CREATE INDEX IF NOT EXISTS "CallEvent_callId_createdAt_idx" ON "CallEvent"("callId", "createdAt");
CREATE INDEX IF NOT EXISTS "CallEvent_userId_createdAt_idx" ON "CallEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CallEvent_eventType_createdAt_idx" ON "CallEvent"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "UserSubscription_userId_status_validUntil_idx" ON "UserSubscription"("userId", "status", "validUntil");
CREATE INDEX IF NOT EXISTS "UserSubscription_validUntil_idx" ON "UserSubscription"("validUntil");

DO $$
BEGIN
  ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_chatId_fkey"
    FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CallParticipant" ADD CONSTRAINT "CallParticipant_callId_fkey"
    FOREIGN KEY ("callId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CallParticipant" ADD CONSTRAINT "CallParticipant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CallEvent" ADD CONSTRAINT "CallEvent_callId_fkey"
    FOREIGN KEY ("callId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CallEvent" ADD CONSTRAINT "CallEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

