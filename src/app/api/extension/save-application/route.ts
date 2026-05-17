import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthContext, validateExtensionRequest } from "@/lib/services/extensionAuth";
import { createApplicationAnswer, createAutofillLog, setApplicationExtensionFields } from "@/lib/services/phase2Storage";
import { isAutomationAllowed } from "@/lib/services/sourcePolicy";
import { logAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await validateExtensionRequest(request, 40);
  if (!isAuthContext(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  const job = await prisma.job.findFirst({ where: { id: jobId, userId: auth.userId } });
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const jobAny = job as typeof job & { sourcePlatform?: string | null; automationLevel?: any; sourceType?: any };
  if (!isAutomationAllowed(jobAny.automationLevel ?? "save_only", "assisted_apply")) {
    await logAudit({
      userId: auth.userId,
      action: "automation_blocked",
      entityType: "Job",
      entityId: job.id,
      source: job.source,
      metadata: { reason: "Extension assisted apply blocked by source policy.", sourceType: jobAny.sourceType, automationLevel: jobAny.automationLevel }
    });
    return NextResponse.json({ error: "Source policy allows saving only. Assisted apply is blocked for this job." }, { status: 403 });
  }

  const application = await prisma.application.upsert({
    where: { userId_jobId: { userId: auth.userId, jobId: job.id } },
    update: {
      sourceUrl: job.applyUrl,
      notes: typeof body.notes === "string" ? body.notes : undefined
    } as any,
    create: {
      userId: auth.userId,
      jobId: job.id,
      sourceUrl: job.applyUrl,
      status: "READY_TO_APPLY",
      notes: typeof body.notes === "string" ? body.notes : ""
    } as any
  });
  await setApplicationExtensionFields(application.id, { appliedViaExtension: true });

  const filledFields = sanitizeFieldLog(body.filledFields);
  const skippedFields = sanitizeFieldLog(body.skippedFields);
  if (filledFields.length || skippedFields.length) {
    await createAutofillLog({
      applicationId: application.id,
      pageUrl: typeof body.pageUrl === "string" ? body.pageUrl : job.applyUrl,
      sourcePlatform: typeof body.sourcePlatform === "string" ? body.sourcePlatform : jobAny.sourcePlatform || job.source,
      filledFields,
      skippedFields
    });
  }

  if (Array.isArray(body.answers)) {
    for (const item of body.answers.slice(0, 20)) {
      if (typeof item.question !== "string" || typeof item.generatedAnswer !== "string") continue;
      await createApplicationAnswer({
        applicationId: application.id,
        question: item.question.slice(0, 1000),
        generatedAnswer: item.generatedAnswer.slice(0, 4000),
        finalAnswer: typeof item.finalAnswer === "string" ? item.finalAnswer.slice(0, 4000) : null,
        needsConfirmation: Boolean(item.needsConfirmation)
      });
    }
  }

  const updated = await prisma.application.findUnique({
    where: { id: application.id },
    include: { job: { include: { matches: { orderBy: { createdAt: "desc" }, take: 1 } } } }
  });

  return NextResponse.json({ application: updated });
}

function sanitizeFieldLog(value: unknown): Array<{ label: string; profileKey?: string; filled?: boolean }> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    return {
      label: String(item.label ?? item.name ?? "Field").slice(0, 160),
      profileKey: item.profileKey ? String(item.profileKey).slice(0, 60) : undefined,
      filled: Boolean(item.filled)
    };
  });
}
