import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateApplicationAnswer } from "@/lib/services/answerGeneration";
import { isAuthContext, validateExtensionRequest } from "@/lib/services/extensionAuth";
import { listAnswerTemplates } from "@/lib/services/phase2Storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await validateExtensionRequest(request, 25);
  if (!isAuthContext(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return NextResponse.json({ error: "Question is required." }, { status: 400 });

  const [resume, preferences, templates, job] = await Promise.all([
    prisma.resume.findFirst({ where: { userId: auth.userId, isActive: true }, orderBy: { createdAt: "desc" } }),
    prisma.jobPreference.findFirst({ where: { userId: auth.userId }, orderBy: { updatedAt: "desc" } }),
    listAnswerTemplates(auth.userId),
    typeof body.jobId === "string" ? prisma.job.findFirst({ where: { id: body.jobId, userId: auth.userId } }) : Promise.resolve(null)
  ]);

  const answer = await generateApplicationAnswer(
    {
      question,
      fieldLimit: typeof body.fieldLimit === "number" ? body.fieldLimit : null,
      tone: body.tone === "concise" || body.tone === "confident" ? body.tone : "professional",
      jobDescription: typeof body.jobDescription === "string" ? body.jobDescription : "",
      jobTitle: typeof body.jobTitle === "string" ? body.jobTitle : "",
      company: typeof body.company === "string" ? body.company : ""
    },
    resume,
    preferences,
    templates,
    job
  );

  return NextResponse.json(answer);
}
