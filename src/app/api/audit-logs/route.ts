import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { listAuditLogs } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getDemoUser();
  const logs = await listAuditLogs(user.id);
  return NextResponse.json({ logs });
}
