ALTER TABLE "GroupMember"
ADD COLUMN IF NOT EXISTS "leftAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "GroupMember_groupId_leftAt_idx"
ON "GroupMember"("groupId", "leftAt");

CREATE INDEX IF NOT EXISTS "GroupMember_userId_leftAt_idx"
ON "GroupMember"("userId", "leftAt");
