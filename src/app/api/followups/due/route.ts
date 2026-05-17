import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { listDueFollowUps } from "@/lib/services/followUps";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getDemoUser();
  const followUps = await listDueFollowUps(user.id);
  return NextResponse.json({ followUps });
}
