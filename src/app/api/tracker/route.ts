import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getApplicationPhase2Fields, getJobPhase2Fields } from "@/lib/services/phase2Storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getDemoUser();
  const applications = await prisma.application.findMany({
    where: { userId: user.id },
    include: { job: { include: { matches: { orderBy: { createdAt: "desc" }, take: 1 } } } },
    orderBy: { updatedAt: "desc" }
  });
  const [applicationPhase2, jobPhase2] = await Promise.all([
    getApplicationPhase2Fields(applications.map((application) => application.id)),
    getJobPhase2Fields(applications.map((application) => application.job.id))
  ]);

  return NextResponse.json({
    applications: applications.map((application) => ({
      ...application,
      ...(applicationPhase2[application.id] ?? {}),
      job: { ...application.job, ...(jobPhase2[application.job.id] ?? {}) }
    }))
  });
}
