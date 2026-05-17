import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthContext, validateExtensionRequest } from "@/lib/services/extensionAuth";
import { listAnswerTemplates } from "@/lib/services/phase2Storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await validateExtensionRequest(request);
  if (!isAuthContext(auth)) return auth;

  const preferences = await prisma.jobPreference.findFirst({
    where: { userId: auth.userId },
    orderBy: { updatedAt: "desc" }
  });
  const templates = await listAnswerTemplates(auth.userId);

  return NextResponse.json({ preferences, answerTemplates: templates });
}
