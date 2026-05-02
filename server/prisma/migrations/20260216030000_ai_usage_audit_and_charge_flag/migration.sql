-- AlterTable
ALTER TABLE "AiRequestLog"
ADD COLUMN "providerUsageRaw" JSONB,
ADD COLUMN "charged" BOOLEAN NOT NULL DEFAULT false;

