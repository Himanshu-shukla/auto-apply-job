import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateApplicantProfile, updateApplicantProfile } from "@/lib/services/applicantProfile";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const [profile, resumes] = await Promise.all([
    getOrCreateApplicantProfile(user.id),
    prisma.resume.findMany({
      where: { userId: user.id },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      select: { id: true, fileName: true, fileType: true, filePath: true, isActive: true, createdAt: true }
    })
  ]);
  return NextResponse.json({ profile, resumes: resumes.map((resume) => ({ ...resume, downloadUrl: resume.filePath })) });
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const profile = await updateApplicantProfile(user.id, await request.json().catch(() => ({})));
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save profile." }, { status: 400 });
  }
}
