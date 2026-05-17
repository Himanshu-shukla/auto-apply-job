import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getJobPhase2Fields } from "@/lib/services/phase2Storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getDemoUser();
  const jobs = await prisma.job.findMany({
    where: { userId: user.id },
    include: {
      matches: { orderBy: { createdAt: "desc" }, take: 1 },
      applications: { where: { userId: user.id }, take: 1 }
    },
    orderBy: { updatedAt: "desc" }
  });
  const phase2 = await getJobPhase2Fields(jobs.map((job) => job.id));

  return NextResponse.json({ jobs: jobs.map((job) => ({ ...job, ...(phase2[job.id] ?? {}) })) });
}
