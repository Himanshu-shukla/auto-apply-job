-- Add structured applicant profile data used by the web app and extension.
CREATE TABLE "ApplicantProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "currentLocation" TEXT NOT NULL DEFAULT '',
  "targetRole" TEXT NOT NULL DEFAULT '',
  "expectedSalary" TEXT NOT NULL DEFAULT '',
  "availability" TEXT NOT NULL DEFAULT '',
  "workAuthorization" TEXT NOT NULL DEFAULT '',
  "visaStatus" TEXT NOT NULL DEFAULT '',
  "linkedIn" TEXT NOT NULL DEFAULT '',
  "portfolio" TEXT NOT NULL DEFAULT '',
  "github" TEXT NOT NULL DEFAULT '',
  "preferredResumeId" TEXT,
  "workHistory" JSONB NOT NULL DEFAULT '[]',
  "education" JSONB NOT NULL DEFAULT '[]',
  "certificates" JSONB NOT NULL DEFAULT '[]',
  "customAnswers" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ApplicantProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApplicantProfile_userId_key" ON "ApplicantProfile"("userId");
CREATE INDEX "ApplicantProfile_userId_idx" ON "ApplicantProfile"("userId");

ALTER TABLE "ApplicantProfile"
  ADD CONSTRAINT "ApplicantProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
