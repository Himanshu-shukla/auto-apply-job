import { getDemoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findProviderBySource, getJobProviders } from "@/lib/providers";
import type { ProviderCapabilities, SubmitApplicationInput } from "@/lib/providers/types";
import { calculateRuleBasedMatchScore, parsedResumeFromRecord } from "@/lib/services/matchScoring";
import { evaluateAutomationRule, listRules } from "@/lib/services/automationRules";
import { logAudit } from "@/lib/services/audit";
import { checkDailyLimit } from "@/lib/services/rateLimits";
import { ensureDefaultResumeVersion } from "@/lib/services/resumeVersions";
import { generateApplicationEmail, sendEmailApplication } from "@/lib/services/emailApplications";
import { getAutomationSetting } from "@/lib/services/settings";
import { createNotification } from "@/lib/services/notifications";
import { classifySource, defaultAutomationLevel, detectRecruiterEmail, enforceSourceAutomationLevel, isAutomationAllowed } from "@/lib/services/sourcePolicy";
import { logProviderRun, matchConfiguredSource } from "@/lib/services/jobSources";
import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";

const allowedTargetCounts = [50, 100, 500];

export type CampaignInput = {
  name?: string;
  targetCount?: number;
  minMatchScore?: number;
  titleIncludes?: string;
  locationIncludes?: string;
};

export function evaluateCampaignQueueDecision(input: {
  sourceType: string;
  automationLevel: string;
  matchScore: number;
  minMatchScore: number;
}): { queue: boolean; status: "needs_review" | "blocked"; recommendedAction: string } {
  if (input.matchScore < input.minMatchScore) return { queue: false, status: "blocked", recommendedAction: "below_match_threshold" };
  const job = { sourceType: input.sourceType, automationLevel: input.automationLevel };
  const status = input.sourceType === "unknown" || input.automationLevel === "save_only" ? "blocked" : "needs_review";
  return { queue: true, status, recommendedAction: recommendedAction(job) };
}

export async function listCampaigns(userId: string) {
  return (prisma as any).applicationCampaign.findMany({
    where: { userId },
    include: { campaignJobs: { include: { job: true }, orderBy: { createdAt: "asc" }, take: 8 } },
    orderBy: { createdAt: "desc" }
  });
}

export async function getCampaign(userId: string, id: string) {
  return (prisma as any).applicationCampaign.findFirst({
    where: { id, userId },
    include: {
      campaignJobs: {
        include: {
          job: { include: { matches: { orderBy: { createdAt: "desc" }, take: 1 } } },
          application: true,
          attempts: { orderBy: { attemptedAt: "desc" }, take: 3 }
        },
        orderBy: [{ status: "asc" }, { matchScore: "desc" }]
      },
      attempts: { orderBy: { attemptedAt: "desc" }, take: 20 }
    }
  });
}

export async function createCampaign(userId: string, body: CampaignInput) {
  const targetCount = allowedTargetCounts.includes(Number(body.targetCount)) ? Number(body.targetCount) : 50;
  const minMatchScore = clamp(Number(body.minMatchScore), 0, 100, 70);
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : `Bulk apply ${targetCount}`;
  const settings = await getAutomationSetting(userId);
  const campaign = await (prisma as any).applicationCampaign.create({
    data: {
      userId,
      name,
      targetCount,
      minMatchScore,
      status: "preparing",
      approvalMode: settings.approvalMode,
      filters: { titleIncludes: body.titleIncludes ?? "", locationIncludes: body.locationIncludes ?? "" },
      sourcePolicySnapshot: {
        restrictedPlatforms: "assisted_apply_only",
        unknownSources: "save_only",
        directEmail: "requires_approved_source_and_queue_approval",
        officialApi: "requires_official_credentials",
        createdAt: new Date().toISOString()
      }
    }
  });

  await prepareCampaign(userId, campaign.id);
  await logAudit({ userId, action: "campaign_created", entityType: "ApplicationCampaign", entityId: campaign.id, metadata: { targetCount, minMatchScore } });
  return getCampaign(userId, campaign.id);
}

export async function prepareCampaign(userId: string, campaignId: string) {
  const campaign = await (prisma as any).applicationCampaign.findFirst({ where: { id: campaignId, userId } });
  if (!campaign) throw new Error("Campaign not found.");
  const preferences = await prisma.jobPreference.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
  if (!preferences) throw new Error("Save job preferences before creating a campaign.");
  const activeResume = await prisma.resume.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "desc" } });
  if (!activeResume) throw new Error("Upload an active resume before creating a campaign.");

  const normalizedJobs = await searchProviders(userId, preferences as JobPreferenceInput);
  const existingJobs = await (prisma as any).job.findMany({
    where: { userId },
    include: { matches: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
    take: campaign.targetCount * 2
  });
  const storedJobs = await upsertNormalizedJobs(userId, normalizedJobs, preferences as JobPreferenceInput, activeResume);
  const candidates = dedupeJobs([...storedJobs, ...existingJobs]).filter((job) => passesCampaignFilters(job, campaign.filters));
  const rules = await listRules(userId);
  let prepared = 0;

  for (const job of candidates) {
    if (prepared >= campaign.targetCount) break;
    const score = job.matches?.[0]?.overallScore ?? (await scoreJob(job, activeResume, preferences));
    if (score < campaign.minMatchScore) continue;
    const ruleResults = rules.map((rule: any) => evaluateAutomationRule(rule, { ...job, matches: [{ overallScore: score }] }));
    if (rules.length && !ruleResults.some((result: { matched: boolean }) => result.matched)) continue;

    const application = await (prisma as any).application.upsert({
      where: { userId_jobId: { userId, jobId: job.id } },
      update: { sourceUrl: job.applyUrl, status: "READY_TO_APPLY" },
      create: { userId, jobId: job.id, sourceUrl: job.applyUrl, status: "READY_TO_APPLY" }
    });
    const packet = await buildApplicationPacket(userId, job, application.id);
    const status = job.sourceType === "unknown" || job.automationLevel === "save_only" ? "blocked" : "needs_review";
    await (prisma as any).campaignJob.upsert({
      where: { campaignId_jobId: { campaignId, jobId: job.id } },
      update: {
        applicationId: application.id,
        status,
        matchScore: score,
        recommendedAction: recommendedAction(job),
        riskWarnings: riskWarnings(job),
        generatedPayload: packet,
        sourceCapabilities: providerCapabilities(job.source)
      },
      create: {
        userId,
        campaignId,
        jobId: job.id,
        applicationId: application.id,
        status,
        matchScore: score,
        recommendedAction: recommendedAction(job),
        riskWarnings: riskWarnings(job),
        generatedPayload: packet,
        sourceCapabilities: providerCapabilities(job.source)
      }
    });
    prepared += 1;
  }

  const counts = await summarizeCampaignJobs(campaignId);
  await (prisma as any).applicationCampaign.update({
    where: { id: campaignId },
    data: { status: "ready", preparedCount: counts.prepared, failedCount: counts.failed }
  });
  await createNotification({
    userId,
    type: "campaign_prepared",
    title: "Bulk apply campaign prepared",
    message: `${counts.prepared} job(s) are ready for review in ${campaign.name}.`,
    link: `/campaigns/${campaignId}`
  });
}

export async function setCampaignStatus(userId: string, id: string, status: "running" | "paused") {
  const data: Record<string, unknown> = { status };
  if (status === "running") data.startedAt = new Date();
  const campaign = await (prisma as any).applicationCampaign.updateMany({ where: { id, userId }, data });
  if (!campaign.count) throw new Error("Campaign not found.");
  await logAudit({ userId, action: `campaign_${status}`, entityType: "ApplicationCampaign", entityId: id });
  return getCampaign(userId, id);
}

export async function approveCampaignJob(userId: string, campaignId: string, campaignJobId: string) {
  const updated = await (prisma as any).campaignJob.updateMany({
    where: { id: campaignJobId, campaignId, userId, status: { in: ["needs_review", "failed"] } },
    data: { status: "ready", approvedAt: new Date(), rejectedAt: null }
  });
  if (!updated.count) throw new Error("Campaign job not found or not reviewable.");
  await logAudit({ userId, action: "campaign_job_approved", entityType: "CampaignJob", entityId: campaignJobId });
  return getCampaign(userId, campaignId);
}

export async function rejectCampaignJob(userId: string, campaignId: string, campaignJobId: string) {
  const updated = await (prisma as any).campaignJob.updateMany({
    where: { id: campaignJobId, campaignId, userId },
    data: { status: "skipped", rejectedAt: new Date() }
  });
  if (!updated.count) throw new Error("Campaign job not found.");
  await logAudit({ userId, action: "campaign_job_rejected", entityType: "CampaignJob", entityId: campaignJobId });
  return getCampaign(userId, campaignId);
}

export async function runNextCampaignJob(userId: string, campaignId: string) {
  const campaign = await (prisma as any).applicationCampaign.findFirst({ where: { id: campaignId, userId } });
  if (!campaign) throw new Error("Campaign not found.");
  if (campaign.status !== "running") throw new Error("Start the campaign before running jobs.");
  const item = await (prisma as any).campaignJob.findFirst({
    where: { campaignId, userId, status: "ready" },
    include: { job: true, application: true },
    orderBy: [{ matchScore: "desc" }, { createdAt: "asc" }]
  });
  if (!item) {
    await completeIfDone(userId, campaignId);
    return { message: "No approved ready jobs remain.", campaign: await getCampaign(userId, campaignId) };
  }

  const job = item.job;
  const action = job.automationLevel;
  const attemptBase = {
    userId,
    campaignId,
    campaignJobId: item.id,
    jobId: job.id,
    applicationId: item.applicationId,
    provider: job.source,
    action,
    requestPayload: { sourcePolicySnapshot: campaign.sourcePolicySnapshot, generatedPayload: item.generatedPayload },
    consentAt: item.approvedAt ?? new Date()
  };

  try {
    if (job.sourceType === "restricted_platform" || job.sourceType === "unknown") {
      throw new Error("Source policy blocks auto-submit for restricted or unknown sources.");
    }
    const daily = await checkDailyLimit(userId, "application", job.source);
    if (!daily.allowed) throw new Error(daily.reason ?? "Daily application limit reached.");

    if (job.sourceType === "direct_email" && isAutomationAllowed(job.automationLevel, "auto_send_email")) {
      const generated = await generateApplicationEmail(userId, item.applicationId);
      await (prisma as any).approvalQueueItem.updateMany({
        where: { userId, applicationId: item.applicationId, generatedPayload: { path: ["emailApplicationId"], equals: generated.emailApplication.id } },
        data: { status: "approved", approvedAt: item.approvedAt ?? new Date() }
      });
      const sent = await sendEmailApplication(userId, item.applicationId, { manual: false });
      await markAttemptSubmitted(attemptBase, { emailApplicationId: sent.id });
      await markCampaignJobSubmitted(userId, item.id, campaignId);
      return { message: "Direct email application sent.", campaign: await getCampaign(userId, campaignId) };
    }

    if (job.sourceType === "official_api" && isAutomationAllowed(job.automationLevel, "api_apply")) {
      const provider = findProviderBySource(job.source);
      if (!provider?.submitApplication || !provider.capabilities?.canSubmit) throw new Error("No official submit adapter is configured for this source.");
      const payload = await submitPayload(userId, job, item, campaign.sourcePolicySnapshot);
      const result = await provider.submitApplication(payload);
      if (!result.submitted) throw new Error(result.message);
      await markAttemptSubmitted(attemptBase, result);
      await (prisma as any).application.update({
        where: { id: item.applicationId },
        data: { status: "APPLIED", appliedDate: new Date(), submittedAt: new Date(), automationUsed: true, approvalStatus: "sent" }
      });
      await markCampaignJobSubmitted(userId, item.id, campaignId);
      return { message: result.message, campaign: await getCampaign(userId, campaignId) };
    }

    throw new Error("This source is ready for extension-assisted apply, not backend auto-submit.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Application attempt failed.";
    await (prisma as any).applicationAttempt.create({ data: { ...attemptBase, status: "blocked", errorMessage: message } });
    await (prisma as any).campaignJob.update({ where: { id: item.id }, data: { status: "failed", lastAttemptAt: new Date() } });
    await (prisma as any).applicationCampaign.update({ where: { id: campaignId }, data: { failedCount: { increment: 1 } } });
    await logAudit({ userId, action: "campaign_attempt_blocked", entityType: "CampaignJob", entityId: item.id, source: job.source, metadata: { message } });
    return { message, campaign: await getCampaign(userId, campaignId) };
  }
}

async function searchProviders(userId: string, preferences: JobPreferenceInput): Promise<NormalizedJob[]> {
  const providers = getJobProviders().filter((provider) => provider.capabilities?.canSearch !== false);
  const results = await Promise.all(providers.map(async (provider) => {
    try {
      const jobs = await provider.searchJobs(preferences);
      await logProviderRun({ userId, provider: provider.sourceName, status: "success", imported: jobs.length, metadata: { campaignSearch: true, capabilities: provider.capabilities } });
      return jobs;
    } catch (error) {
      await logProviderRun({ userId, provider: provider.sourceName, status: "failed", failedReason: error instanceof Error ? error.message : "Provider failed.", metadata: { campaignSearch: true } });
      return [];
    }
  }));
  return results.flat();
}

async function upsertNormalizedJobs(userId: string, jobs: NormalizedJob[], preferences: JobPreferenceInput, activeResume: any) {
  const stored = [];
  for (const normalized of jobs) {
    const sourceType = (normalized.sourceType as any) ?? classifySource(normalized);
    const configuredSource = await matchConfiguredSource(userId, normalized.applyUrl);
    const recruiterEmail = normalized.recruiterEmail ?? detectRecruiterEmail(`${normalized.applyUrl} ${normalized.description}`);
    const automationLevel = enforceSourceAutomationLevel({
      sourceType,
      requestedLevel: (normalized.automationLevel as any) ?? configuredSource?.automationLevel ?? defaultAutomationLevel(sourceType),
      configuredLevel: configuredSource?.automationLevel,
      companyDomainAllowed: configuredSource?.sourceType === "company_career_page" && ["one_click_apply", "api_apply"].includes(configuredSource.automationLevel),
      directEmailApproved: configuredSource?.sourceType === "direct_email" && configuredSource.automationLevel === "auto_send_email",
      hasOfficialCredentials: configuredSource?.sourceType === "official_api" && configuredSource.automationLevel === "api_apply"
    });
    const data = {
      ...normalized,
      postedDate: normalized.postedDate ? new Date(normalized.postedDate) : null,
      userId,
      sourceType,
      automationLevel,
      sourceId: configuredSource?.id ?? null,
      recruiterEmail,
      riskFlags: riskWarnings({ ...normalized, sourceType, automationLevel })
    };
    const existing = await (prisma as any).job.findFirst({ where: { userId, source: normalized.source, applyUrl: normalized.applyUrl } });
    const job = existing ? await (prisma as any).job.update({ where: { id: existing.id }, data }) : await (prisma as any).job.create({ data });
    await scoreJob(job, activeResume, preferences);
    stored.push(await (prisma as any).job.findUnique({ where: { id: job.id }, include: { matches: { orderBy: { createdAt: "desc" }, take: 1 } } }));
  }
  return stored.filter(Boolean);
}

async function scoreJob(job: any, activeResume: any, preferences: any): Promise<number> {
  const score = calculateRuleBasedMatchScore(parsedResumeFromRecord(activeResume), job, preferences);
  await (prisma as any).jobMatchScore.create({ data: { ...score, jobId: job.id, resumeId: activeResume.id } });
  return score.overallScore;
}

async function buildApplicationPacket(userId: string, job: any, applicationId: string) {
  const resumeVersion = await ensureDefaultResumeVersion(userId);
  return {
    applicationId,
    resumeVersionId: resumeVersion?.id ?? null,
    resumeVersionName: resumeVersion?.name ?? null,
    coverLetter: `Prepared for ${job.title} at ${job.company}. Review and personalize before submission.`,
    answers: [],
    sourcePolicy: {
      sourceType: job.sourceType,
      automationLevel: job.automationLevel,
      finalSubmitAllowed: canBackendSubmit(job)
    },
    preparedAt: new Date().toISOString()
  };
}

async function submitPayload(userId: string, job: any, item: any, sourcePolicySnapshot: Record<string, unknown>): Promise<SubmitApplicationInput> {
  const [user, resumeVersion] = await Promise.all([getDemoUser(), ensureDefaultResumeVersion(userId)]);
  const parsed = resumeVersion?.parsedJson as Record<string, unknown> | undefined;
  return {
    userId,
    job,
    applicant: {
      fullName: parsed?.name ?? user.name ?? "",
      email: user.email,
      phone: parsed?.phone ?? "",
      currentLocation: parsed?.location ?? "",
      skills: parsed?.skills ?? []
    },
    resume: resumeVersion ? { name: resumeVersion.name, url: resumeVersion.fileUrl, text: resumeVersion.rawText } : undefined,
    coverLetter: { text: item.generatedPayload?.coverLetter ?? "" },
    answers: item.generatedPayload?.answers ?? [],
    consentAt: new Date().toISOString(),
    campaignId: item.campaignId,
    sourcePolicySnapshot
  };
}

function dedupeJobs(jobs: any[]): any[] {
  const seen = new Set<string>();
  const result = [];
  for (const job of jobs) {
    const key = `${job.applyUrl || ""}|${job.company || ""}|${job.title || ""}`.toLowerCase();
    if (!job.id || seen.has(key)) continue;
    seen.add(key);
    result.push(job);
  }
  return result;
}

function passesCampaignFilters(job: any, filters: any): boolean {
  const title = String(filters?.titleIncludes ?? "").trim().toLowerCase();
  const location = String(filters?.locationIncludes ?? "").trim().toLowerCase();
  if (title && !String(job.title).toLowerCase().includes(title)) return false;
  if (location && !String(job.location).toLowerCase().includes(location)) return false;
  return true;
}

function providerCapabilities(source: string): ProviderCapabilities {
  return findProviderBySource(source)?.capabilities ?? {
    canSearch: false,
    canCapture: true,
    canAssistedApply: true,
    canSubmit: false,
    requiresCredential: false,
    restrictedReason: "No provider capability metadata was found."
  };
}

function recommendedAction(job: any): string {
  if (job.sourceType === "restricted_platform") return "assisted_apply";
  if (job.sourceType === "unknown" || job.automationLevel === "save_only") return "save_only";
  if (canBackendSubmit(job)) return "submit_after_approval";
  return "extension_assisted_apply";
}

function riskWarnings(job: any): string[] {
  if (job.sourceType === "restricted_platform") return ["Restricted platform: auto-submit is blocked; use assisted apply only."];
  if (job.sourceType === "unknown") return ["Unknown source: save-only until classified."];
  if (job.automationLevel === "save_only") return ["Source can be saved and reviewed, but not submitted automatically."];
  return [];
}

function canBackendSubmit(job: any): boolean {
  return (job.sourceType === "direct_email" && isAutomationAllowed(job.automationLevel, "auto_send_email")) ||
    (job.sourceType === "official_api" && isAutomationAllowed(job.automationLevel, "api_apply"));
}

async function markAttemptSubmitted(attemptBase: Record<string, unknown>, responsePayload: unknown) {
  await (prisma as any).applicationAttempt.create({ data: { ...attemptBase, status: "submitted", responsePayload } });
}

async function markCampaignJobSubmitted(userId: string, itemId: string, campaignId: string) {
  await (prisma as any).campaignJob.update({ where: { id: itemId }, data: { status: "submitted", lastAttemptAt: new Date() } });
  await (prisma as any).applicationCampaign.update({ where: { id: campaignId }, data: { submittedCount: { increment: 1 } } });
  await logAudit({ userId, action: "campaign_job_submitted", entityType: "CampaignJob", entityId: itemId });
  await completeIfDone(userId, campaignId);
}

async function completeIfDone(userId: string, campaignId: string) {
  const remaining = await (prisma as any).campaignJob.count({ where: { campaignId, userId, status: { in: ["ready", "needs_review"] } } });
  if (remaining === 0) {
    await (prisma as any).applicationCampaign.update({ where: { id: campaignId }, data: { status: "completed", completedAt: new Date() } });
  }
}

async function summarizeCampaignJobs(campaignId: string) {
  const [prepared, failed] = await Promise.all([
    (prisma as any).campaignJob.count({ where: { campaignId } }),
    (prisma as any).campaignJob.count({ where: { campaignId, status: "failed" } })
  ]);
  return { prepared, failed };
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
}
