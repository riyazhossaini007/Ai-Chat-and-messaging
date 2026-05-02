-- CreateEnum
CREATE TYPE "PrivacyAudience" AS ENUM ('EVERYONE', 'CONTACTS', 'NOBODY');

-- CreateEnum
CREATE TYPE "TwoFactorState" AS ENUM ('OFF', 'SETUP_REQUIRED', 'ON');

-- AlterTable
ALTER TABLE "UserSettings"
ADD COLUMN "lastSeenAudience" "PrivacyAudience" NOT NULL DEFAULT 'CONTACTS',
ADD COLUMN "profilePhotoAudience" "PrivacyAudience" NOT NULL DEFAULT 'EVERYONE',
ADD COLUMN "readReceiptsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "twoFactorState" "TwoFactorState" NOT NULL DEFAULT 'OFF';

-- CreateTable
CREATE TABLE "UserBlock" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "UserBlock_blockerId_idx" ON "UserBlock"("blockerId");

-- CreateIndex
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
