import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthContext, validateExtensionRequest } from "@/lib/services/extensionAuth";
import { getApplicantProfile } from "@/lib/services/applicantProfile";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await validateExtensionRequest(request);
  if (!isAuthContext(auth)) return auth;

  const [resumes, profile] = await Promise.all([
    prisma.resume.findMany({
      where: { userId: auth.userId },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        fileName: true,
        fileType: true,
        filePath: true,
        totalExperienceYears: true,
        isActive: true,
        createdAt: true
      }
    }),
    getApplicantProfile(auth.userId)
  ]);

  return NextResponse.json({
    resumes: resumes.map((resume) => ({
      ...resume,
      downloadUrl: resume.filePath,
      preferred: profile?.preferredResumeId === resume.id
    }))
  });
}
