import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { listApprovalQueue } from "@/lib/services/approvalQueue";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getDemoUser();
  const items = await listApprovalQueue(user.id);
  return NextResponse.json({ items });
}
