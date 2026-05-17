import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { markNotificationRead } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  await markNotificationRead(user.id, params.id);
  return NextResponse.json({ ok: true });
}
