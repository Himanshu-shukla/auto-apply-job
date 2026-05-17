import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { getResumePerformance } from "@/lib/services/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getDemoUser();
  return NextResponse.json({ resumes: await getResumePerformance(user.id) });
}
