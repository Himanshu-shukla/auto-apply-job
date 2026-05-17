import { NextRequest, NextResponse } from "next/server";
import { type ApplicationStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { nextApplicationHistory } from "@/lib/services/application";
import { isAuthContext, validateExtensionRequest } from "@/lib/services/extensionAuth";
import { setApplicationExtensionFields } from "@/lib/services/phase2Storage";

const statuses: ApplicationStatus[] = ["SAVED", "READY_TO_APPLY", "APPLIED", "INTERVIEW", "OFFER", "REJECTED"];

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const auth = await validateExtensionRequest(request, 40);
  if (!isAuthContext(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const applicationId = typeof body.applicationId === "string" ? body.applicationId : "";
  const application = await prisma.application.findFirst({ where: { id: applicationId, userId: auth.userId } });
  if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  const nextStatus = statuses.includes(body.status) ? body.status : application.status;
  const markApplied = Boolean(body.markApplied) || nextStatus === "APPLIED";
  const updated = await prisma.application.update({
    where: { id: application.id },
    data: {
      status: nextStatus,
      notes: typeof body.notes === "string" ? body.notes : application.notes,
      followUpDate: body.followUpDate ? new Date(body.followUpDate) : application.followUpDate,
      appliedDate: markApplied ? application.appliedDate ?? new Date() : application.appliedDate,
      history:
        nextStatus !== application.status
          ? nextApplicationHistory(application, nextStatus, body.historyNote || "Updated from extension after user confirmation")
          : Array.isArray(application.history)
            ? application.history
            : []
    } as any,
    include: { job: { include: { matches: { orderBy: { createdAt: "desc" }, take: 1 } } } }
  });
  await setApplicationExtensionFields(application.id, {
    appliedViaExtension: true,
    submittedAt: markApplied ? new Date() : null
  });

  return NextResponse.json({ application: updated });
}
