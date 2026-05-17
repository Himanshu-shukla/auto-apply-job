import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const body = await request.json().catch(() => ({}));
  const item = await (prisma as any).approvalQueueItem.updateMany({
    where: { id: params.id, userId: user.id },
    data: {
      riskWarnings: Array.isArray(body.riskWarnings) ? body.riskWarnings.map(String) : undefined,
      recommendedAction: typeof body.recommendedAction === "string" ? body.recommendedAction : undefined,
      generatedPayload: typeof body.generatedPayload === "object" && body.generatedPayload ? body.generatedPayload : undefined,
      status: typeof body.status === "string" ? body.status : undefined
    }
  });
  return NextResponse.json({ item });
}
