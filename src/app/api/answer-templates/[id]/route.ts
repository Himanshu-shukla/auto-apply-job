import { NextRequest, NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { deleteAnswerTemplate, findAnswerTemplate, updateAnswerTemplate } from "@/lib/services/phase2Storage";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  const current = await findAnswerTemplate(params.id, user.id);
  if (!current) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  const template = await updateAnswerTemplate(
    current.id,
    typeof body.label === "string" ? body.label.trim() : current.label,
    typeof body.questionType === "string" ? body.questionType.trim() : current.questionType,
    typeof body.answer === "string" ? body.answer.trim() : current.answer
  );
  return NextResponse.json({ template });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getDemoUser();
  const current = await findAnswerTemplate(params.id, user.id);
  if (!current) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  await deleteAnswerTemplate(current.id);
  return NextResponse.json({ deleted: true });
}
