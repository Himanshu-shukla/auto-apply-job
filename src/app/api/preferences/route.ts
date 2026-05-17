import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizePreferences } from "@/lib/services/preferences";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const preferences = await prisma.jobPreference.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" }
  });
  return NextResponse.json({ preferences });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  const normalized = normalizePreferences(await request.json());
  if (!normalized.targetRole) {
    return NextResponse.json({ error: "Target role is required." }, { status: 400 });
  }

  const existing = await prisma.jobPreference.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" }
  });

  const preferences = existing
    ? await prisma.jobPreference.update({ where: { id: existing.id }, data: normalized })
    : await prisma.jobPreference.create({ data: { ...normalized, userId: user.id } });

  return NextResponse.json({ preferences });
}
