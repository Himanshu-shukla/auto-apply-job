import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAIResponse } from "@/lib/ai";
import { calculateRuleBasedMatchScore, parsedResumeFromRecord } from "@/lib/services/matchScoring";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const [job, resume, preferences] = await Promise.all([
    prisma.job.findFirst({ where: { id: params.id, userId: user.id } }),
    prisma.resume.findFirst({ where: { userId: user.id, isActive: true }, orderBy: { createdAt: "desc" } }),
    prisma.jobPreference.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } })
  ]);

  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  if (!resume) return NextResponse.json({ error: "Upload a resume before matching jobs." }, { status: 400 });

  const parsedResume = parsedResumeFromRecord(resume);
  const initial = calculateRuleBasedMatchScore(parsedResume, job, preferences);
  const ai = await generateAIResponse<{ explanation: string }>(
    "Explain the fit between a resume and job truthfully. Do not invent missing skills.",
    JSON.stringify({ parsedResume, job, ruleBasedScore: initial }),
    { explanation: "string" }
  );
  const score = calculateRuleBasedMatchScore(
    parsedResume,
    job,
    preferences,
    typeof ai === "object" && ai && "explanation" in ai ? ai.explanation : initial.aiExplanation
  );

  const match = await prisma.jobMatchScore.create({
    data: { ...score, jobId: job.id, resumeId: resume.id }
  });

  return NextResponse.json({ match });
}
