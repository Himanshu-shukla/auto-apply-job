import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setDefaultResumeVersion } from "@/lib/services/resumeVersions";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const body = await request.json().catch(() => ({}));
  const existing = await (prisma as any).resumeVersion.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Resume version not found." }, { status: 404 });
  if (body.isDefault === true) {
    const version = await setDefaultResumeVersion(user.id, params.id);
    return NextResponse.json({ version });
  }
  const version = await (prisma as any).resumeVersion.update({
    where: { id: params.id },
    data: {
      name: typeof body.name === "string" ? body.name : existing.name,
      targetRole: typeof body.targetRole === "string" ? body.targetRole : existing.targetRole,
      rawText: typeof body.rawText === "string" ? body.rawText : existing.rawText,
      parsedJson: typeof body.parsedJson === "object" && body.parsedJson ? body.parsedJson : existing.parsedJson
    }
  });
  return NextResponse.json({ version });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  await (prisma as any).resumeVersion.deleteMany({ where: { id: params.id, userId: user.id, isDefault: false } });
  return NextResponse.json({ ok: true });
}
