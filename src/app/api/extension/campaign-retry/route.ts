import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthContext, validateExtensionRequest } from "@/lib/services/extensionAuth";
import { logAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await validateExtensionRequest(request);
  if (!isAuthContext(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const updated = await (prisma as any).campaignJob.updateMany({
    where: {
      id: String(body.campaignJobId || ""),
      campaignId: String(body.campaignId || ""),
      userId: auth.userId,
      status: { in: ["failed", "blocked"] }
    },
    data: { status: "ready" }
  });
  if (!updated.count) return NextResponse.json({ error: "Retryable campaign job not found." }, { status: 404 });

  await logAudit({
    userId: auth.userId,
    action: "extension_campaign_retry",
    entityType: "CampaignJob",
    entityId: String(body.campaignJobId || "")
  });
  return NextResponse.json({ ok: true });
}
