import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCoverLetter } from "@/lib/services/coverLetter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const body = await request.json().catch(() => ({}));
  const [job, resume, preferences] = await Promise.all([
    prisma.job.findFirst({ where: { id: params.id, userId: user.id } }),
    prisma.resume.findFirst({ where: { userId: user.id, isActive: true }, orderBy: { createdAt: "desc" } }),
    prisma.jobPreference.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } })
  ]);

  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  if (!resume) return NextResponse.json({ error: "Upload a resume before generating a cover letter." }, { status: 400 });

  const content = typeof body.content === "string" && body.content.trim() ? body.content.trim() : await generateCoverLetter(resume, job, preferences);
  const coverLetter = await prisma.coverLetter.create({
    data: { userId: user.id, jobId: job.id, resumeId: resume.id, content }
  });

  await prisma.application.upsert({
    where: { userId_jobId: { userId: user.id, jobId: job.id } },
    update: { coverLetter: content, sourceUrl: job.applyUrl },
    create: { userId: user.id, jobId: job.id, coverLetter: content, sourceUrl: job.applyUrl }
  });

  return NextResponse.json({ coverLetter });
}
