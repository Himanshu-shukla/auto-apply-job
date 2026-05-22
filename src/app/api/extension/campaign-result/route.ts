import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { isAuthContext, validateExtensionRequest } from "@/lib/services/extensionAuth";
import { logAudit } from "@/lib/services/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PROOF_BYTES = 2_500_000;

export async function POST(request: NextRequest) {
  const auth = await validateExtensionRequest(request);
  if (!isAuthContext(auth)) return auth;

  try {
    const body = await request.json();
    const campaignJob = await (prisma as any).campaignJob.findFirst({
      where: { id: String(body.campaignJobId || ""), campaignId: String(body.campaignId || ""), userId: auth.userId },
      include: { job: true, application: true }
    });
    if (!campaignJob) return NextResponse.json({ error: "Campaign job not found." }, { status: 404 });

    const proofUrl = await saveProofImage(auth.userId, body.proofImage);
    const status = normalizeResultStatus(body.status, campaignJob.job);
    const errorMessage = typeof body.errorMessage === "string" ? body.errorMessage.slice(0, 1000) : null;
    const responsePayload = {
      pageUrl: typeof body.pageUrl === "string" ? body.pageUrl : campaignJob.job.applyUrl,
      proofUrl,
      filledFields: sanitizeLog(body.filledFields),
      skippedFields: sanitizeLog(body.skippedFields),
      attachment: sanitizeAttachment(body.attachment),
      automationState: body.automationState ?? null,
      finalSubmitClicked: Boolean(body.finalSubmitClicked),
      completedAt: new Date().toISOString()
    };

    await (prisma as any).applicationAttempt.create({
      data: {
        userId: auth.userId,
        campaignId: campaignJob.campaignId,
        campaignJobId: campaignJob.id,
        jobId: campaignJob.jobId,
        applicationId: campaignJob.applicationId,
        provider: campaignJob.job.source,
        action: campaignJob.job.automationLevel,
        status: status.attemptStatus,
        requestPayload: { extensionQueue: true },
        responsePayload,
        errorMessage,
        consentAt: new Date()
      }
    });

    await (prisma as any).autofillLog.create({
      data: {
        applicationId: campaignJob.applicationId,
        pageUrl: responsePayload.pageUrl,
        sourcePlatform: campaignJob.job.sourcePlatform || campaignJob.job.source,
        filledFields: responsePayload.filledFields,
        skippedFields: responsePayload.skippedFields
      }
    });

    await (prisma as any).campaignJob.update({
      where: { id: campaignJob.id },
      data: { status: status.campaignStatus, lastAttemptAt: new Date() }
    });

    if (status.markApplied) {
      await (prisma as any).application.update({
        where: { id: campaignJob.applicationId },
        data: { status: "APPLIED", appliedDate: new Date(), submittedAt: new Date(), appliedViaExtension: true, automationUsed: true, approvalStatus: "sent" }
      });
      await (prisma as any).applicationCampaign.update({
        where: { id: campaignJob.campaignId },
        data: { submittedCount: { increment: 1 } }
      });
    }

    if (status.campaignStatus === "failed") {
      await (prisma as any).applicationCampaign.update({
        where: { id: campaignJob.campaignId },
        data: { failedCount: { increment: 1 } }
      });
    }

    await logAudit({
      userId: auth.userId,
      action: "extension_campaign_result",
      entityType: "CampaignJob",
      entityId: campaignJob.id,
      source: campaignJob.job.source,
      metadata: { status: body.status, campaignStatus: status.campaignStatus, proofUrl }
    });

    return NextResponse.json({ ok: true, campaignStatus: status.campaignStatus, proofUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save campaign result." }, { status: 400 });
  }
}

function normalizeResultStatus(status: unknown, job: any) {
  if (status === "manually_submitted") {
    return { attemptStatus: "submitted", campaignStatus: "submitted", markApplied: true };
  }
  if (status === "skipped") return { attemptStatus: "blocked", campaignStatus: "skipped", markApplied: false };
  if (status === "submitted" && job.sourceType === "company_career_page" && job.automationLevel === "one_click_apply") {
    return { attemptStatus: "submitted", campaignStatus: "submitted", markApplied: true };
  }
  if (status === "failed") return { attemptStatus: "failed", campaignStatus: "failed", markApplied: false };
  return { attemptStatus: "blocked", campaignStatus: "blocked", markApplied: false };
}

async function saveProofImage(userId: string, proofImage: unknown): Promise<string | null> {
  if (typeof proofImage !== "string" || !proofImage.startsWith("data:image/")) return null;
  const match = proofImage.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_PROOF_BYTES) return null;
  const ext = match[1] === "jpeg" ? "jpg" : "png";
  const dir = path.join(process.cwd(), "public", "uploads", "proofs");
  await mkdir(dir, { recursive: true });
  const fileName = `${Date.now()}-${userId.slice(0, 8)}.${ext}`;
  await writeFile(path.join(dir, fileName), buffer);
  return `/uploads/proofs/${fileName}`;
}

function sanitizeLog(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 80).map((item: any) => ({
    label: String(item?.label ?? item?.profileKey ?? "").slice(0, 120),
    profileKey: String(item?.profileKey ?? "").slice(0, 80),
    filled: Boolean(item?.filled),
    reason: item?.reason ? String(item.reason).slice(0, 240) : undefined
  }));
}

function sanitizeAttachment(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const item = value as any;
  return {
    attached: Boolean(item.attached),
    fileName: item.fileName ? String(item.fileName).slice(0, 180) : undefined,
    reason: item.reason ? String(item.reason).slice(0, 240) : undefined
  };
}
