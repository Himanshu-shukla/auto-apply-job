import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseResumeText } from "@/lib/services/resumeParser";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const resume = await prisma.resume.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({ resume });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  const body = await request.json();
  const current = await prisma.resume.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { createdAt: "desc" }
  });

  if (!current) {
    return NextResponse.json({ error: "Upload a resume before editing parsed details." }, { status: 404 });
  }

  const parsedJson = body.parsedJson ?? parseResumeText(current.rawText);
  const resume = await prisma.resume.update({
    where: { id: current.id },
    data: {
      parsedJson,
      totalExperienceYears: Number(parsedJson.totalExperienceYears ?? current.totalExperienceYears ?? 0)
    }
  });

  return NextResponse.json({ resume });
}
