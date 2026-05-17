import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getDemoUser();
  const job = await prisma.job.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      matches: { orderBy: { createdAt: "desc" }, take: 1 },
      suggestions: { where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 1 },
      coverLetters: { where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 1 },
      applications: { where: { userId: user.id }, take: 1 }
    }
  });

  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  return NextResponse.json({ job });
}
