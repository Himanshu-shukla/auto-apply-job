-- Bulk apply campaigns, durable queue items, provider credentials, and submission attempts.

CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'preparing', 'ready', 'running', 'paused', 'completed', 'failed');
CREATE TYPE "CampaignJobStatus" AS ENUM ('queued', 'needs_review', 'ready', 'blocked', 'submitted', 'failed', 'skipped');
CREATE TYPE "ApplicationAttemptStatus" AS ENUM ('pending', 'blocked', 'submitted', 'failed');

CREATE TABLE "ApplicationCampaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL DEFAULT 50,
    "minMatchScore" INTEGER NOT NULL DEFAULT 70,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "approvalMode" "ApprovalMode" NOT NULL DEFAULT 'manual_review',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "sourcePolicySnapshot" JSONB NOT NULL DEFAULT '{}',
    "preparedCount" INTEGER NOT NULL DEFAULT 0,
    "submittedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "applicationId" TEXT,
    "status" "CampaignJobStatus" NOT NULL DEFAULT 'queued',
    "matchScore" INTEGER NOT NULL DEFAULT 0,
    "recommendedAction" TEXT NOT NULL DEFAULT 'review',
    "riskWarnings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "generatedPayload" JSONB NOT NULL DEFAULT '{}',
    "sourceCapabilities" JSONB NOT NULL DEFAULT '{}',
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT,
    "campaignJobId" TEXT,
    "jobId" TEXT NOT NULL,
    "applicationId" TEXT,
    "provider" TEXT NOT NULL,
    "status" "ApplicationAttemptStatus" NOT NULL DEFAULT 'pending',
    "action" "AutomationLevel" NOT NULL DEFAULT 'assisted_apply',
    "requestPayload" JSONB NOT NULL DEFAULT '{}',
    "responsePayload" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    "consentAt" TIMESTAMP(3),
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "credentialType" TEXT NOT NULL DEFAULT 'api_key',
    "secretRef" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderCredential_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApplicationCampaign_userId_status_createdAt_idx" ON "ApplicationCampaign"("userId", "status", "createdAt");
CREATE UNIQUE INDEX "CampaignJob_campaignId_jobId_key" ON "CampaignJob"("campaignId", "jobId");
CREATE INDEX "CampaignJob_userId_status_idx" ON "CampaignJob"("userId", "status");
CREATE INDEX "CampaignJob_campaignId_status_idx" ON "CampaignJob"("campaignId", "status");
CREATE INDEX "CampaignJob_applicationId_idx" ON "CampaignJob"("applicationId");
CREATE INDEX "ApplicationAttempt_userId_status_attemptedAt_idx" ON "ApplicationAttempt"("userId", "status", "attemptedAt");
CREATE INDEX "ApplicationAttempt_campaignId_idx" ON "ApplicationAttempt"("campaignId");
CREATE INDEX "ApplicationAttempt_campaignJobId_idx" ON "ApplicationAttempt"("campaignJobId");
CREATE INDEX "ApplicationAttempt_applicationId_idx" ON "ApplicationAttempt"("applicationId");
CREATE INDEX "ProviderCredential_userId_provider_enabled_idx" ON "ProviderCredential"("userId", "provider", "enabled");

ALTER TABLE "ApplicationCampaign" ADD CONSTRAINT "ApplicationCampaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignJob" ADD CONSTRAINT "CampaignJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignJob" ADD CONSTRAINT "CampaignJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ApplicationCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignJob" ADD CONSTRAINT "CampaignJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignJob" ADD CONSTRAINT "CampaignJob_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApplicationAttempt" ADD CONSTRAINT "ApplicationAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationAttempt" ADD CONSTRAINT "ApplicationAttempt_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ApplicationCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApplicationAttempt" ADD CONSTRAINT "ApplicationAttempt_campaignJobId_fkey" FOREIGN KEY ("campaignJobId") REFERENCES "CampaignJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApplicationAttempt" ADD CONSTRAINT "ApplicationAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationAttempt" ADD CONSTRAINT "ApplicationAttempt_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderCredential" ADD CONSTRAINT "ProviderCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
