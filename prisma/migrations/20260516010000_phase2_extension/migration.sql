-- Phase 2 assisted-apply extension support.

ALTER TABLE "Job"
ADD COLUMN "sourcePlatform" TEXT,
ADD COLUMN "capturedFromExtension" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "originalPageUrl" TEXT;

ALTER TABLE "Application"
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "appliedViaExtension" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ExtensionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ExtensionToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnswerTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationAnswer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "generatedAnswer" TEXT NOT NULL,
    "finalAnswer" TEXT,
    "needsConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutofillLog" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "sourcePlatform" TEXT,
    "filledFields" JSONB NOT NULL,
    "skippedFields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutofillLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExtensionToken_tokenHash_key" ON "ExtensionToken"("tokenHash");
CREATE INDEX "ExtensionToken_userId_idx" ON "ExtensionToken"("userId");
CREATE INDEX "AnswerTemplate_userId_idx" ON "AnswerTemplate"("userId");
CREATE INDEX "ApplicationAnswer_applicationId_idx" ON "ApplicationAnswer"("applicationId");
CREATE INDEX "AutofillLog_applicationId_idx" ON "AutofillLog"("applicationId");

ALTER TABLE "ExtensionToken" ADD CONSTRAINT "ExtensionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnswerTemplate" ADD CONSTRAINT "AnswerTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutofillLog" ADD CONSTRAINT "AutofillLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
