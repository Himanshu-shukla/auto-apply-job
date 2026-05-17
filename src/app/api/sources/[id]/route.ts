import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateJobSource } from "@/lib/services/jobSources";
import { logAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  try {
    const source = await updateJobSource(user.id, params.id, await request.json().catch(() => ({})));
    return NextResponse.json({ source });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Source update failed." }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  await (prisma as any).jobSource.deleteMany({ where: { id: params.id, userId: user.id } });
  await logAudit({ userId: user.id, action: "automation_blocked", entityType: "JobSource", entityId: params.id, metadata: { deleted: true } });
  return NextResponse.json({ ok: true });
}
