import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthContext, validateExtensionRequest } from "@/lib/services/extensionAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await validateExtensionRequest(request);
  if (!isAuthContext(auth)) return auth;

  const coverLetters = await prisma.coverLetter.findMany({
    where: { userId: auth.userId },
    include: { job: { select: { id: true, title: true, company: true } } },
    orderBy: { updatedAt: "desc" },
    take: 20
  });

  return NextResponse.json({
    coverLetters: coverLetters.map(({ id, content, updatedAt, job }) => ({ id, content, updatedAt, job }))
  });
}
