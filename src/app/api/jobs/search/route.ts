import { NextRequest, NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getJobProviders } from "@/lib/providers";
import { normalizeManualJob } from "@/lib/providers/manualJobImport";
import { calculateRuleBasedMatchScore, parsedResumeFromRecord } from "@/lib/services/matchScoring";
import { logAudit } from "@/lib/services/audit";
import { createNotification } from "@/lib/services/notifications";
import { logProviderRun, matchConfiguredSource } from "@/lib/services/jobSources";
import { classifySource, defaultAutomationLevel, detectRecruiterEmail, enforceSourceAutomationLevel } from "@/lib/services/sourcePolicy";
import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await getDemoUser();
    const body = await request.json().catch(() => ({}));
    const preferences = await prisma.jobPreference.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" }
    });
    if (!preferences) {
      return NextResponse.json({ error: "Save job preferences before searching." }, { status: 400 });
    }

    const providers = getJobProviders();
    const providerResults = await Promise.all(
      providers.map(async (provider) => {
        try {
          const jobs = await provider.searchJobs(preferences as JobPreferenceInput);
          await logProviderRun({ userId: user.id, provider: provider.sourceName, status: "success", imported: jobs.length });
          return jobs;
        } catch (error) {
          await logProviderRun({
            userId: user.id,
            provider: provider.sourceName,
            status: "failed",
            failedReason: error instanceof Error ? error.message : "Provider failed."
          });
          return [];
        }
      })
    );
    const providerJobs = providerResults.flat();

    const manualJobs: NormalizedJob[] = body.manualDescription
      ? [
          normalizeManualJob({
            description: body.manualDescription,
            url: body.manualUrl,
            title: body.manualTitle,
            company: body.manualCompany,
            location: body.manualLocation
          })
        ]
      : [];

    const activeResume = await prisma.resume.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: "desc" }
    });

    const storedJobs = [];
    for (const normalized of [...providerJobs, ...manualJobs]) {
      const sourceType = (normalized.sourceType as any) ?? classifySource(normalized);
      const configuredSource = await matchConfiguredSource(user.id, normalized.applyUrl);
      const recruiterEmail = normalized.recruiterEmail ?? detectRecruiterEmail(`${normalized.applyUrl} ${normalized.description}`);
      const automationLevel = enforceSourceAutomationLevel({
        sourceType,
        requestedLevel: (normalized.automationLevel as any) ?? configuredSource?.automationLevel ?? defaultAutomationLevel(sourceType),
        configuredLevel: configuredSource?.automationLevel,
        companyDomainAllowed: configuredSource?.sourceType === "company_career_page" && ["one_click_apply", "api_apply"].includes(configuredSource.automationLevel),
        directEmailApproved: configuredSource?.sourceType === "direct_email" && configuredSource.automationLevel === "auto_send_email",
        hasOfficialCredentials: configuredSource?.sourceType === "official_api" && configuredSource.automationLevel === "api_apply"
      });
      const riskFlags = sourceType === "restricted_platform"
        ? ["Restricted platform: assisted apply only."]
        : sourceType === "unknown"
          ? ["Unknown source: save-only until classified."]
          : [];
      const existing = await prisma.job.findFirst({
        where: { userId: user.id, source: normalized.source, applyUrl: normalized.applyUrl }
      });
      const job = existing
        ? await prisma.job.update({
            where: { id: existing.id },
            data: {
              ...normalized,
              postedDate: normalized.postedDate ? new Date(normalized.postedDate) : null,
              sourceType,
              automationLevel,
              sourceId: configuredSource?.id ?? null,
              recruiterEmail,
              riskFlags
            } as any
          })
        : await prisma.job.create({
            data: {
              ...normalized,
              postedDate: normalized.postedDate ? new Date(normalized.postedDate) : null,
              userId: user.id,
              sourceType,
              automationLevel,
              sourceId: configuredSource?.id ?? null,
              recruiterEmail,
              riskFlags
            } as any
          });

      if (activeResume) {
        const score = calculateRuleBasedMatchScore(parsedResumeFromRecord(activeResume), job, preferences);
        await prisma.jobMatchScore.create({
          data: { ...score, jobId: job.id, resumeId: activeResume.id }
        });
        await logAudit({ userId: user.id, action: "match_score_generated", entityType: "Job", entityId: job.id, source: job.source, metadata: { score: score.overallScore } });
        if (score.overallScore >= 80) {
          await createNotification({
            userId: user.id,
            type: "high_match_job",
            title: "New high-match job found",
            message: `${job.title} at ${job.company} scored ${score.overallScore}/100.`,
            link: `/jobs/${job.id}`
          });
        }
      }

      await prisma.application.upsert({
        where: { userId_jobId: { userId: user.id, jobId: job.id } },
        update: { sourceUrl: job.applyUrl },
        create: { userId: user.id, jobId: job.id, sourceUrl: job.applyUrl, status: "SAVED" }
      });
      await logAudit({ userId: user.id, action: "job_imported", entityType: "Job", entityId: job.id, source: job.source, metadata: { sourceType, automationLevel } });

      storedJobs.push(job);
    }

    return NextResponse.json({ jobs: storedJobs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Job search failed." }, { status: 500 });
  }
}
