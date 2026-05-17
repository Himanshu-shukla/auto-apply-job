import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSourcePerformance } from "@/lib/services/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ sources: await getSourcePerformance(user.id) });
}
