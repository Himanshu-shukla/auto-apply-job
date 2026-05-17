import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { listNotifications } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getDemoUser();
  const notifications = await listNotifications(user.id);
  return NextResponse.json({ notifications });
}
