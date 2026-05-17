import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { getSourcePerformance } from "@/lib/services/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getDemoUser();
  return NextResponse.json({ sources: await getSourcePerformance(user.id) });
}
