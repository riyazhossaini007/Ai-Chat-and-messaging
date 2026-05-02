-- AlterTable
ALTER TABLE "Chat"
ADD COLUMN "encVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "dekWrapped" TEXT,
ADD COLUMN "dekKekId" TEXT;

-- AlterTable
ALTER TABLE "Message"
ADD COLUMN "cipherText" TEXT,
ADD COLUMN "iv" TEXT,
ADD COLUMN "authTag" TEXT,
ADD COLUMN "algo" TEXT,
ADD COLUMN "encVersion" INTEGER;
