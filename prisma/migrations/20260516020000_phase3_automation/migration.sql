-- Phase 3 controlled automation, safe source policy, email applications, analytics, and auditability.

CREATE TYPE "SourceType" AS ENUM ('restricted_platform', 'official_api', 'company_career_page', 'direct_email', 'user_imported', 'partner_feed', 'unknown');
CREATE TYPE "AutomationLevel" AS ENUM ('view_only', 'save_only', 'assisted_apply', 'one_click_apply', 'auto_send_email', 'api_apply');
CREATE TYPE "ApprovalMode" AS ENUM ('manual_review', 'one_click_approve', 'allowed_source_auto_send_only');
CREATE TYPE "ApprovalQueueStatus" AS ENUM ('pending_review', 'approved', 'rejected', 'sent', 'failed', 'skipped');
CREATE TYPE "EmailApplicationStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'sent', 'failed', 'cancelled');
CREATE TYPE "FollowUpStatus" AS ENUM ('due', 'pending_review', 'approved', 'sent', 'skipped', 'failed', 'disabled');

ALTER TABLE "Job"
ADD COLUMN "sourceType" "SourceType" NOT NULL DEFAULT 'unknown',
ADD COLUMN "automationLevel" "AutomationLevel" NOT NULL DEFAULT 'save_only',
ADD COLUMN "sourceId" TEXT,
ADD COLUMN "recruiterEmail" TEXT,
ADD COLUMN "riskFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Application"
ADD COLUMN "resumeVersionId" TEXT,
ADD COLUMN "approvalStatus" "ApprovalQueueStatus",
ADD COLUMN "automationUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastFollowUpAt" TIMESTAMP(3),
ADD COLUMN "responseStatus" TEXT;

CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetTitles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "locations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "remotePreference" "RemoteType" NOT NULL DEFAULT 'FLEXIBLE',
    "minMatchScore" INTEGER NOT NULL DEFAULT 0,
    "minSalary" INTEGER,
    "requiredSkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "excludedCompanies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "excludedKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "maxApplicationsPerDay" INTEGER NOT NULL DEFAULT 10,
    "approvalMode" "ApprovalMode" NOT NULL DEFAULT 'manual_review',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL DEFAULT 'unknown',
    "domain" TEXT,
    "baseUrl" TEXT,
    "automationLevel" "AutomationLevel" NOT NULL DEFAULT 'save_only',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalQueueItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "applicationId" TEXT,
    "status" "ApprovalQueueStatus" NOT NULL DEFAULT 'pending_review',
    "riskWarnings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "recommendedAction" TEXT NOT NULL,
    "generatedPayload" JSONB NOT NULL DEFAULT '{}',
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalQueueItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "cc" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "attachmentResumeVersionId" TEXT,
    "status" "EmailApplicationStatus" NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "followUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "emailApplicationId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'due',
    "subject" TEXT,
    "body" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResumeVersion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT,
    "name" TEXT NOT NULL,
    "targetRole" TEXT,
    "fileUrl" TEXT,
    "rawText" TEXT NOT NULL,
    "parsedJson" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResumeVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "source" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "automationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "approvalMode" "ApprovalMode" NOT NULL DEFAULT 'manual_review',
    "maxApplicationsPerDay" INTEGER NOT NULL DEFAULT 10,
    "maxEmailsPerDay" INTEGER NOT NULL DEFAULT 10,
    "maxFollowUpsPerDay" INTEGER NOT NULL DEFAULT 5,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 3,
    "blockedCompanies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "blockedKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sourceCaps" JSONB NOT NULL DEFAULT '{}',
    "strictTruthfulness" BOOLEAN NOT NULL DEFAULT true,
    "aiTone" TEXT NOT NULL DEFAULT 'professional',
    "coverLetterLength" TEXT NOT NULL DEFAULT 'medium',
    "answerLength" TEXT NOT NULL DEFAULT 'concise',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderName" TEXT,
    "emailSignature" TEXT NOT NULL DEFAULT '',
    "defaultSubjectTemplate" TEXT NOT NULL DEFAULT 'Application for [Role] - [Candidate Name]',
    "followUpTemplate" TEXT NOT NULL DEFAULT '',
    "replyToEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderRunLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "failedReason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderRunLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Job_sourceType_idx" ON "Job"("sourceType");
CREATE INDEX "Application_resumeVersionId_idx" ON "Application"("resumeVersionId");
CREATE INDEX "AutomationRule_userId_enabled_idx" ON "AutomationRule"("userId", "enabled");
CREATE INDEX "JobSource_userId_sourceType_idx" ON "JobSource"("userId", "sourceType");
CREATE INDEX "JobSource_domain_idx" ON "JobSource"("domain");
CREATE INDEX "ApprovalQueueItem_userId_status_idx" ON "ApprovalQueueItem"("userId", "status");
CREATE INDEX "ApprovalQueueItem_jobId_idx" ON "ApprovalQueueItem"("jobId");
CREATE INDEX "ApprovalQueueItem_applicationId_idx" ON "ApprovalQueueItem"("applicationId");
CREATE INDEX "EmailApplication_userId_status_idx" ON "EmailApplication"("userId", "status");
CREATE INDEX "EmailApplication_applicationId_idx" ON "EmailApplication"("applicationId");
CREATE INDEX "FollowUp_userId_status_dueDate_idx" ON "FollowUp"("userId", "status", "dueDate");
CREATE INDEX "FollowUp_applicationId_idx" ON "FollowUp"("applicationId");
CREATE INDEX "ResumeVersion_userId_isDefault_idx" ON "ResumeVersion"("userId", "isDefault");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE UNIQUE INDEX "AutomationSetting_userId_key" ON "AutomationSetting"("userId");
CREATE UNIQUE INDEX "EmailSetting_userId_key" ON "EmailSetting"("userId");
CREATE INDEX "ProviderRunLog_userId_provider_createdAt_idx" ON "ProviderRunLog"("userId", "provider", "createdAt");

ALTER TABLE "Job" ADD CONSTRAINT "Job_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "JobSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobSource" ADD CONSTRAINT "JobSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalQueueItem" ADD CONSTRAINT "ApprovalQueueItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalQueueItem" ADD CONSTRAINT "ApprovalQueueItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalQueueItem" ADD CONSTRAINT "ApprovalQueueItem_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailApplication" ADD CONSTRAINT "EmailApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailApplication" ADD CONSTRAINT "EmailApplication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailApplication" ADD CONSTRAINT "EmailApplication_attachmentResumeVersionId_fkey" FOREIGN KEY ("attachmentResumeVersionId") REFERENCES "ResumeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_emailApplicationId_fkey" FOREIGN KEY ("emailApplicationId") REFERENCES "EmailApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResumeVersion" ADD CONSTRAINT "ResumeVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResumeVersion" ADD CONSTRAINT "ResumeVersion_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationSetting" ADD CONSTRAINT "AutomationSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailSetting" ADD CONSTRAINT "EmailSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderRunLog" ADD CONSTRAINT "ProviderRunLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
