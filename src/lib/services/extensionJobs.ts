import type { JobPreference, Resume } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateRuleBasedMatchScore, parsedResumeFromRecord } from "@/lib/services/matchScoring";
import { setJobExtensionFields } from "@/lib/services/phase2Storage";
import { logAudit } from "@/lib/services/audit";
import { matchConfiguredSource } from "@/lib/services/jobSources";
import { classifySource, defaultAutomationLevel, detectRecruiterEmail, enforceSourceAutomationLevel } from "@/lib/services/sourcePolicy";
import type { NormalizedJob } from "@/lib/types";

export type CapturedJobInput = {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  applyUrl?: string;
  pageUrl?: string;
  sourcePlatform?: string;
  detectedSalary?: string | null;
  detectedExperienceRequirement?: string | null;
};

export function normalizeCapturedJob(input: CapturedJobInput): NormalizedJob & {
  sourcePlatform: string;
  originalPageUrl: string;
  capturedFromExtension: true;
} {
  const description = clean(input.description) || "Captured from browser extension. Review the source page for full details.";
  const sourcePlatform = clean(input.sourcePlatform) || inferSourcePlatform(input.applyUrl || input.pageUrl || "");
  const salary = parseSalary(input.detectedSalary || description);
  return {
    title: clean(input.title) || "Captured Job",
    company: clean(input.company) || "Unknown Company",
    location: clean(input.location) || "Not specified",
    remoteType: /remote/i.test(`${input.location} ${description}`) ? "REMOTE" : "FLEXIBLE",
    salaryMin: salary.min,
    salaryMax: salary.max,
    experienceRequired: parseExperience(input.detectedExperienceRequirement || description),
    description,
    applyUrl: clean(input.applyUrl) || clean(input.pageUrl) || "https://example.com",
    source: sourcePlatform,
    sourcePlatform,
    originalPageUrl: clean(input.pageUrl) || clean(input.applyUrl) || "https://example.com",
    capturedFromExtension: true
  };
}

export async function captureJobForUser(userId: string, input: CapturedJobInput) {
  const normalized = normalizeCapturedJob(input);
  const sourceType = classifySource(normalized);
  const configuredSource = await matchConfiguredSource(userId, normalized.applyUrl);
  const recruiterEmail = detectRecruiterEmail(`${normalized.applyUrl} ${normalized.description}`);
  const automationLevel = enforceSourceAutomationLevel({
    sourceType,
    requestedLevel: configuredSource?.automationLevel ?? defaultAutomationLevel(sourceType),
    configuredLevel: configuredSource?.automationLevel,
    companyDomainAllowed: configuredSource?.sourceType === "company_career_page" && ["one_click_apply", "api_apply"].includes(configuredSource.automationLevel),
    directEmailApproved: configuredSource?.sourceType === "direct_email" && configuredSource.automationLevel === "auto_send_email",
    hasOfficialCredentials: configuredSource?.sourceType === "official_api" && configuredSource.automationLevel === "api_apply"
  });
  const existing = await prisma.job.findFirst({
    where: { userId, source: normalized.source, applyUrl: normalized.applyUrl }
  });

  const jobData = {
    title: normalized.title,
    company: normalized.company,
    location: normalized.location,
    remoteType: normalized.remoteType,
    salaryMin: normalized.salaryMin,
    salaryMax: normalized.salaryMax,
    experienceRequired: normalized.experienceRequired,
    description: normalized.description,
    applyUrl: normalized.applyUrl,
    source: normalized.source,
    postedDate: normalized.postedDate ? new Date(normalized.postedDate) : null,
    sourceType,
    automationLevel,
    sourceId: configuredSource?.id ?? null,
    recruiterEmail,
    riskFlags: sourceType === "restricted_platform" ? ["Restricted platform: assisted apply only."] : sourceType === "unknown" ? ["Unknown source: save-only until classified."] : []
  };

  const job = existing
    ? await prisma.job.update({
        where: { id: existing.id },
        data: jobData as any
      })
    : await prisma.job.create({
        data: { ...jobData, userId } as any
      });
  await setJobExtensionFields(job.id, {
    sourcePlatform: normalized.sourcePlatform,
    capturedFromExtension: true,
    originalPageUrl: normalized.originalPageUrl
  });

  const [resume, preferences] = await Promise.all([
    prisma.resume.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "desc" } }),
    prisma.jobPreference.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } })
  ]);

  const match = resume ? await createMatchScore(job.id, resume, preferences) : null;
  await logAudit({ userId, action: "job_imported", entityType: "Job", entityId: job.id, source: job.source, metadata: { capturedFromExtension: true, sourceType, automationLevel } });
  if (match) {
    await logAudit({ userId, action: "match_score_generated", entityType: "Job", entityId: job.id, source: job.source, metadata: { score: match.overallScore } });
  }
  const application = await prisma.application.upsert({
    where: { userId_jobId: { userId, jobId: job.id } },
    update: { sourceUrl: job.applyUrl },
    create: { userId, jobId: job.id, sourceUrl: job.applyUrl, status: "SAVED" }
  });

  return { job, match, application };
}

export async function createMatchScore(jobId: string, resume: Resume, preferences?: JobPreference | null) {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  const score = calculateRuleBasedMatchScore(parsedResumeFromRecord(resume), job, preferences);
  return prisma.jobMatchScore.create({
    data: { ...score, jobId, resumeId: resume.id }
  });
}

export function inferSourcePlatform(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (/greenhouse/i.test(host)) return "Greenhouse";
    if (/lever/i.test(host)) return "Lever";
    if (/workday/i.test(host)) return "Workday";
    if (/linkedin/i.test(host)) return "LinkedIn";
    if (/indeed/i.test(host)) return "Indeed";
    if (/glassdoor/i.test(host)) return "Glassdoor";
    if (/naukri/i.test(host)) return "Naukri";
    return host || "Captured Page";
  } catch {
    return "Captured Page";
  }
}

function clean(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function parseExperience(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b/i);
  return match ? Number(match[1]) : null;
}

function parseSalary(text: string): { min: number | null; max: number | null } {
  const normalized = text.replace(/,/g, "");
  const range = normalized.match(/(?:\$|₹|INR|USD)?\s*(\d{2,7})(?:\s*(?:k|lpa|lakhs?))?\s*(?:-|to)\s*(?:\$|₹|INR|USD)?\s*(\d{2,7})(?:\s*(k|lpa|lakhs?))?/i);
  if (range) {
    const multiplier = /k/i.test(range[3] || "") ? 1000 : /lpa|lakh/i.test(range[3] || "") ? 100000 : 1;
    return { min: Number(range[1]) * multiplier, max: Number(range[2]) * multiplier };
  }
  const single = normalized.match(/(?:\$|₹|INR|USD)\s*(\d{4,7})/i);
  return { min: single ? Number(single[1]) : null, max: null };
}
