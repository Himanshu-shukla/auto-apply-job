import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { getAnalyticsOverview } from "@/lib/services/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getDemoUser();
  return NextResponse.json(await getAnalyticsOverview(user.id));
}
