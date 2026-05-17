import { NextRequest, NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { createAnswerTemplate, listAnswerTemplates } from "@/lib/services/phase2Storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getDemoUser();
  const templates = await listAnswerTemplates(user.id);
  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  const label = String(body.label ?? "").trim();
  const questionType = String(body.questionType ?? "").trim();
  const answer = String(body.answer ?? "").trim();
  if (!label || !questionType || !answer) {
    return NextResponse.json({ error: "Label, question type, and answer are required." }, { status: 400 });
  }

  const template = await createAnswerTemplate(user.id, label, questionType, answer);
  return NextResponse.json({ template });
}
