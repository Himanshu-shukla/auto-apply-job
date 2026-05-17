import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listAuditLogs } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const logs = await listAuditLogs(user.id);
  return NextResponse.json({ logs });
}
