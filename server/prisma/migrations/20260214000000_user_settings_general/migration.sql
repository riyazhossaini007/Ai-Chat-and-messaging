-- CreateEnum
CREATE TYPE "DateFormat" AS ENUM ('MDY', 'DMY', 'YMD');

-- AlterTable
ALTER TABLE "UserSettings"
ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN "dateFormat" "DateFormat" NOT NULL DEFAULT 'MDY',
ADD COLUMN "autoStart" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "UserSettings_userId_idx" ON "UserSettings"("userId");
