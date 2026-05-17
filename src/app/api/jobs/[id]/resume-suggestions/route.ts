import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildResumeSuggestions } from "@/lib/services/resumeSuggestions";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await getDemoUser();
  const [job, resume] = await Promise.all([
    prisma.job.findFirst({ where: { id: params.id, userId: user.id } }),
    prisma.resume.findFirst({ where: { userId: user.id, isActive: true }, orderBy: { createdAt: "desc" } })
  ]);

  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  if (!resume) return NextResponse.json({ error: "Upload a resume before generating suggestions." }, { status: 400 });

  const result = await buildResumeSuggestions(resume, job);
  const suggestion = await prisma.resumeSuggestion.create({
    data: { ...result, userId: user.id, jobId: job.id, resumeId: resume.id }
  });

  return NextResponse.json({ suggestion });
}
