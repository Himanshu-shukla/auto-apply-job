import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthContext, validateExtensionRequest } from "@/lib/services/extensionAuth";
import { createMatchScore } from "@/lib/services/extensionJobs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await validateExtensionRequest(request, 40);
  if (!isAuthContext(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  const [job, resume, preferences] = await Promise.all([
    prisma.job.findFirst({ where: { id: jobId, userId: auth.userId } }),
    prisma.resume.findFirst({ where: { userId: auth.userId, isActive: true }, orderBy: { createdAt: "desc" } }),
    prisma.jobPreference.findFirst({ where: { userId: auth.userId }, orderBy: { updatedAt: "desc" } })
  ]);

  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  if (!resume) return NextResponse.json({ error: "Upload a resume before matching jobs." }, { status: 400 });

  const match = await createMatchScore(job.id, resume, preferences);
  return NextResponse.json({ match });
}
