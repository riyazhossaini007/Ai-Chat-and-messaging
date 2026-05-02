-- AI Memory Layer + Knowledge Engine foundation

CREATE TYPE "KnowledgeItemType" AS ENUM (
  'SUMMARY',
  'TASK',
  'DECISION',
  'IDEA',
  'FACT',
  'FOLLOW_UP',
  'MEETING_NOTE',
  'ISSUE',
  'RISK',
  'MILESTONE'
);

CREATE TYPE "KnowledgeReviewState" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED');
CREATE TYPE "KnowledgeVisibilityScope" AS ENUM ('PRIVATE', 'CHAT', 'GROUP');
CREATE TYPE "MemoryPrivacyScope" AS ENUM ('PRIVATE', 'SHARED_GROUP');
CREATE TYPE "GroupInsightType" AS ENUM (
  'WEEKLY_SUMMARY',
  'DECISION',
  'TASK',
  'BLOCKER',
  'TOPIC',
  'KEY_FILE',
  'CHANGELOG'
);
CREATE TYPE "GroupInsightStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'ARCHIVED');
CREATE TYPE "EmbeddingOwnerType" AS ENUM ('MESSAGE', 'FILE', 'KNOWLEDGE', 'MEMORY', 'GROUP_INSIGHT');
CREATE TYPE "AIContextMode" AS ENUM (
  'SUMMARIZE',
  'ANSWER_QUESTION',
  'EXTRACT_TASKS',
  'EXPLAIN',
  'SEARCH_MEMORY',
  'PROJECT_UPDATE'
);
CREATE TYPE "ResponseSourceType" AS ENUM ('MESSAGE', 'FILE', 'KNOWLEDGE', 'MEMORY', 'GROUP_INSIGHT');

ALTER TABLE "Group"
  ADD COLUMN "aiAutoExtractEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "aiWeeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "aiSemanticSearchEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "KnowledgeItem" (
  "id" TEXT NOT NULL,
  "type" "KnowledgeItemType" NOT NULL,
  "title" TEXT NOT NULL,
  "shortSummary" TEXT NOT NULL,
  "normalizedContent" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "sourceConversationId" TEXT,
  "sourceGroupId" TEXT,
  "authorUserId" TEXT,
  "createdByUserId" TEXT,
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "visibilityScope" "KnowledgeVisibilityScope" NOT NULL,
  "reviewState" "KnowledgeReviewState" NOT NULL DEFAULT 'PENDING',
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "sourceWindowStartedAt" TIMESTAMP(3),
  "sourceWindowEndedAt" TIMESTAMP(3),
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeSourceLink" (
  "id" TEXT NOT NULL,
  "knowledgeItemId" TEXT NOT NULL,
  "messageId" TEXT,
  "fileId" TEXT,
  "chatId" TEXT,
  "groupId" TEXT,
  "excerpt" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeSourceLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserMemory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "shortSummary" TEXT NOT NULL,
  "normalizedContent" TEXT NOT NULL,
  "privacyScope" "MemoryPrivacyScope" NOT NULL DEFAULT 'PRIVATE',
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "topicKey" TEXT,
  "sourceConversationId" TEXT,
  "sourceGroupId" TEXT,
  "pinnedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "forgottenAt" TIMESTAMP(3),
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserMemorySourceLink" (
  "id" TEXT NOT NULL,
  "userMemoryId" TEXT NOT NULL,
  "messageId" TEXT,
  "fileId" TEXT,
  "chatId" TEXT,
  "groupId" TEXT,
  "excerpt" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserMemorySourceLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroupInsight" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "type" "GroupInsightType" NOT NULL,
  "title" TEXT NOT NULL,
  "shortSummary" TEXT NOT NULL,
  "normalizedContent" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "status" "GroupInsightStatus" NOT NULL DEFAULT 'ACTIVE',
  "sourceWindowStartedAt" TIMESTAMP(3),
  "sourceWindowEndedAt" TIMESTAMP(3),
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GroupInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmbeddingRecord" (
  "id" TEXT NOT NULL,
  "ownerType" "EmbeddingOwnerType" NOT NULL,
  "ownerId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL DEFAULT 0,
  "contentHash" TEXT NOT NULL,
  "textContent" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "dimensions" INTEGER NOT NULL,
  "vector" JSONB NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmbeddingRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoryPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "autoMemoryEnabled" BOOLEAN NOT NULL DEFAULT true,
  "allowGroupMemory" BOOLEAN NOT NULL DEFAULT true,
  "allowFileMemory" BOOLEAN NOT NULL DEFAULT true,
  "excludedChatIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "excludedGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "suppressedTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemoryPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIContextSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "chatId" TEXT,
  "groupId" TEXT,
  "aiRequestLogId" TEXT,
  "mode" "AIContextMode" NOT NULL,
  "query" TEXT NOT NULL,
  "selectedMessageId" TEXT,
  "pinnedMemoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "assembledContext" JSONB NOT NULL,
  "tokenBudget" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIContextSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIResponseSource" (
  "id" TEXT NOT NULL,
  "contextSessionId" TEXT NOT NULL,
  "sourceType" "ResponseSourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "title" TEXT,
  "snippet" TEXT,
  "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIResponseSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeItem_fingerprint_key" ON "KnowledgeItem"("fingerprint");
CREATE UNIQUE INDEX "GroupInsight_fingerprint_key" ON "GroupInsight"("fingerprint");
CREATE UNIQUE INDEX "EmbeddingRecord_ownerType_ownerId_chunkIndex_key" ON "EmbeddingRecord"("ownerType", "ownerId", "chunkIndex");
CREATE UNIQUE INDEX "MemoryPreference_userId_key" ON "MemoryPreference"("userId");

CREATE INDEX "KnowledgeItem_sourceConversationId_createdAt_idx" ON "KnowledgeItem"("sourceConversationId", "createdAt");
CREATE INDEX "KnowledgeItem_sourceGroupId_type_createdAt_idx" ON "KnowledgeItem"("sourceGroupId", "type", "createdAt");
CREATE INDEX "KnowledgeItem_visibilityScope_reviewState_createdAt_idx" ON "KnowledgeItem"("visibilityScope", "reviewState", "createdAt");
CREATE INDEX "KnowledgeItem_authorUserId_createdAt_idx" ON "KnowledgeItem"("authorUserId", "createdAt");

CREATE INDEX "KnowledgeSourceLink_knowledgeItemId_createdAt_idx" ON "KnowledgeSourceLink"("knowledgeItemId", "createdAt");
CREATE INDEX "KnowledgeSourceLink_messageId_idx" ON "KnowledgeSourceLink"("messageId");
CREATE INDEX "KnowledgeSourceLink_fileId_idx" ON "KnowledgeSourceLink"("fileId");
CREATE INDEX "KnowledgeSourceLink_chatId_createdAt_idx" ON "KnowledgeSourceLink"("chatId", "createdAt");
CREATE INDEX "KnowledgeSourceLink_groupId_createdAt_idx" ON "KnowledgeSourceLink"("groupId", "createdAt");

CREATE INDEX "UserMemory_userId_createdAt_idx" ON "UserMemory"("userId", "createdAt");
CREATE INDEX "UserMemory_userId_pinnedAt_idx" ON "UserMemory"("userId", "pinnedAt");
CREATE INDEX "UserMemory_userId_archivedAt_idx" ON "UserMemory"("userId", "archivedAt");
CREATE INDEX "UserMemory_userId_forgottenAt_idx" ON "UserMemory"("userId", "forgottenAt");
CREATE INDEX "UserMemory_topicKey_createdAt_idx" ON "UserMemory"("topicKey", "createdAt");

CREATE INDEX "UserMemorySourceLink_userMemoryId_createdAt_idx" ON "UserMemorySourceLink"("userMemoryId", "createdAt");
CREATE INDEX "UserMemorySourceLink_messageId_idx" ON "UserMemorySourceLink"("messageId");
CREATE INDEX "UserMemorySourceLink_fileId_idx" ON "UserMemorySourceLink"("fileId");

CREATE INDEX "GroupInsight_groupId_type_createdAt_idx" ON "GroupInsight"("groupId", "type", "createdAt");
CREATE INDEX "GroupInsight_groupId_status_updatedAt_idx" ON "GroupInsight"("groupId", "status", "updatedAt");
CREATE INDEX "EmbeddingRecord_ownerType_ownerId_idx" ON "EmbeddingRecord"("ownerType", "ownerId");
CREATE INDEX "EmbeddingRecord_contentHash_idx" ON "EmbeddingRecord"("contentHash");
CREATE INDEX "AIContextSession_userId_createdAt_idx" ON "AIContextSession"("userId", "createdAt");
CREATE INDEX "AIContextSession_chatId_createdAt_idx" ON "AIContextSession"("chatId", "createdAt");
CREATE INDEX "AIContextSession_groupId_createdAt_idx" ON "AIContextSession"("groupId", "createdAt");
CREATE INDEX "AIResponseSource_contextSessionId_relevanceScore_idx" ON "AIResponseSource"("contextSessionId", "relevanceScore");
CREATE INDEX "AIResponseSource_sourceType_sourceId_idx" ON "AIResponseSource"("sourceType", "sourceId");

ALTER TABLE "KnowledgeItem"
  ADD CONSTRAINT "KnowledgeItem_sourceConversationId_fkey" FOREIGN KEY ("sourceConversationId") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "KnowledgeItem_sourceGroupId_fkey" FOREIGN KEY ("sourceGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "KnowledgeItem_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "KnowledgeItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KnowledgeSourceLink"
  ADD CONSTRAINT "KnowledgeSourceLink_knowledgeItemId_fkey" FOREIGN KEY ("knowledgeItemId") REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "KnowledgeSourceLink_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "KnowledgeSourceLink_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "MessageMedia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserMemory"
  ADD CONSTRAINT "UserMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UserMemory_sourceConversationId_fkey" FOREIGN KEY ("sourceConversationId") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "UserMemory_sourceGroupId_fkey" FOREIGN KEY ("sourceGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserMemorySourceLink"
  ADD CONSTRAINT "UserMemorySourceLink_userMemoryId_fkey" FOREIGN KEY ("userMemoryId") REFERENCES "UserMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UserMemorySourceLink_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "UserMemorySourceLink_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "MessageMedia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GroupInsight"
  ADD CONSTRAINT "GroupInsight_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryPreference"
  ADD CONSTRAINT "MemoryPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIContextSession"
  ADD CONSTRAINT "AIContextSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AIContextSession_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AIContextSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AIContextSession_aiRequestLogId_fkey" FOREIGN KEY ("aiRequestLogId") REFERENCES "AiRequestLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AIResponseSource"
  ADD CONSTRAINT "AIResponseSource_contextSessionId_fkey" FOREIGN KEY ("contextSessionId") REFERENCES "AIContextSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
