import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthContext, validateExtensionRequest } from "@/lib/services/extensionAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await validateExtensionRequest(request);
  if (!isAuthContext(auth)) return auth;

  const campaignId = request.nextUrl.searchParams.get("campaignId") || undefined;
  const campaigns = await (prisma as any).applicationCampaign.findMany({
    where: {
      userId: auth.userId,
      ...(campaignId ? { id: campaignId } : {}),
      status: { in: ["ready", "running", "paused"] }
    },
    include: {
      campaignJobs: {
        where: { status: { in: ["ready", "failed", "blocked"] } },
        include: {
          job: { include: { matches: { orderBy: { createdAt: "desc" }, take: 1 } } },
          application: true,
          attempts: { orderBy: { attemptedAt: "desc" }, take: 1 }
        },
        orderBy: [{ status: "asc" }, { matchScore: "desc" }, { createdAt: "asc" }],
        take: 100
      }
    },
    orderBy: { updatedAt: "desc" },
    take: 10
  });

  return NextResponse.json({
    campaigns: campaigns.map((campaign: any) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      targetCount: campaign.targetCount,
      preparedCount: campaign.preparedCount,
      submittedCount: campaign.submittedCount,
      failedCount: campaign.failedCount,
      jobs: campaign.campaignJobs.map((item: any) => ({
        id: item.id,
        campaignId: item.campaignId,
        applicationId: item.applicationId,
        status: item.status,
        matchScore: item.matchScore,
        recommendedAction: item.recommendedAction,
        riskWarnings: item.riskWarnings,
        canRetry: ["failed", "blocked"].includes(item.status),
        lastError: item.attempts?.[0]?.errorMessage ?? null,
        job: {
          id: item.job.id,
          title: item.job.title,
          company: item.job.company,
          location: item.job.location,
          applyUrl: item.job.applyUrl,
          source: item.job.source,
          sourceType: item.job.sourceType,
          automationLevel: item.job.automationLevel,
          sourcePlatform: item.job.sourcePlatform,
          description: item.job.description,
          matchScore: item.job.matches?.[0]?.overallScore ?? item.matchScore
        }
      }))
    }))
  });
}
