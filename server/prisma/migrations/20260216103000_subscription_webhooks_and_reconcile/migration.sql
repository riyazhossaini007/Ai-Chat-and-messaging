-- CreateEnum
CREATE TYPE "SubscriptionWebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'ERROR');

-- CreateTable
CREATE TABLE "SubscriptionWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "providerCreatedAt" TIMESTAMP(3),
    "status" "SubscriptionWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "ignoredOutOfOrder" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "rawPayload" JSONB NOT NULL,
    "providerSubscriptionId" TEXT,
    "providerCustomerId" TEXT,
    "subscriptionId" TEXT,
    "userId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionWebhookEvent_provider_eventId_key" ON "SubscriptionWebhookEvent"("provider", "eventId");
CREATE INDEX "SubscriptionWebhookEvent_provider_providerSubscriptionId_providerCreatedAt_idx" ON "SubscriptionWebhookEvent"("provider", "providerSubscriptionId", "providerCreatedAt");
CREATE INDEX "SubscriptionWebhookEvent_status_receivedAt_idx" ON "SubscriptionWebhookEvent"("status", "receivedAt");

-- AddForeignKey
ALTER TABLE "SubscriptionWebhookEvent" ADD CONSTRAINT "SubscriptionWebhookEvent_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubscriptionWebhookEvent" ADD CONSTRAINT "SubscriptionWebhookEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
