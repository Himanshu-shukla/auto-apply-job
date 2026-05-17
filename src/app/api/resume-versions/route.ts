import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createResumeVersion, listResumeVersions } from "@/lib/services/resumeVersions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const versions = await listResumeVersions(user.id);
  return NextResponse.json({ versions });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  const body = await request.json().catch(() => ({}));
  if (typeof body.name !== "string" || typeof body.rawText !== "string") {
    return NextResponse.json({ error: "Name and resume text are required." }, { status: 400 });
  }
  const version = await createResumeVersion(user.id, {
    resumeId: typeof body.resumeId === "string" ? body.resumeId : null,
    name: body.name,
    targetRole: typeof body.targetRole === "string" ? body.targetRole : null,
    fileUrl: typeof body.fileUrl === "string" ? body.fileUrl : null,
    rawText: body.rawText,
    parsedJson: typeof body.parsedJson === "object" && body.parsedJson ? body.parsedJson : {},
    isDefault: Boolean(body.isDefault)
  });
  return NextResponse.json({ version });
}
