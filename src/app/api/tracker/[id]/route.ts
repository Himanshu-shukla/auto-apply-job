import { NextRequest, NextResponse } from "next/server";
import { Prisma, type ApplicationStatus } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextApplicationHistory } from "@/lib/services/application";
import { setApplicationExtensionFields } from "@/lib/services/phase2Storage";

const statuses: ApplicationStatus[] = ["SAVED", "READY_TO_APPLY", "APPLIED", "INTERVIEW", "OFFER", "REJECTED"];

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const body = await request.json();
  const application = await prisma.application.findFirst({ where: { id: params.id, userId: user.id } });
  if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  const nextStatus = statuses.includes(body.status) ? body.status : application.status;
  const markApplied = body.markApplied || (nextStatus === "APPLIED" && application.status !== "APPLIED");
  const data: Prisma.ApplicationUpdateInput = {
    status: nextStatus,
    notes: typeof body.notes === "string" ? body.notes : application.notes,
    appliedDate:
      markApplied
        ? new Date()
        : body.appliedDate
          ? new Date(body.appliedDate)
          : application.appliedDate,
    followUpDate: body.followUpDate ? new Date(body.followUpDate) : application.followUpDate,
    resumeVersion: typeof body.resumeVersion === "string" ? body.resumeVersion : application.resumeVersion,
    resumeVersionId: typeof body.resumeVersionId === "string" ? body.resumeVersionId : (application as any).resumeVersionId,
    coverLetter: typeof body.coverLetter === "string" ? body.coverLetter : application.coverLetter,
    responseStatus: typeof body.responseStatus === "string" ? body.responseStatus : (application as any).responseStatus,
    history:
      nextStatus !== application.status
        ? nextApplicationHistory(application, nextStatus, body.historyNote)
        : Array.isArray(application.history)
          ? application.history
          : []
  } as any;

  const updated = await prisma.application.update({
    where: { id: application.id },
    data,
    include: { job: { include: { matches: { orderBy: { createdAt: "desc" }, take: 1 } } } }
  });
  if (markApplied || typeof body.appliedViaExtension === "boolean") {
    await setApplicationExtensionFields(application.id, {
      appliedViaExtension: typeof body.appliedViaExtension === "boolean" ? body.appliedViaExtension : undefined,
      submittedAt: markApplied ? new Date() : null
    });
  }

  return NextResponse.json({ application: updated });
}
