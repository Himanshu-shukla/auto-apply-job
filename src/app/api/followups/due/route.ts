import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listDueFollowUps } from "@/lib/services/followUps";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const followUps = await listDueFollowUps(user.id);
  return NextResponse.json({ followUps });
}
