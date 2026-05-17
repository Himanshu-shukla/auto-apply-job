import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { rejectQueueItem } from "@/lib/services/approvalQueue";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await getDemoUser();
  const item = await rejectQueueItem(user.id, params.id);
  return NextResponse.json({ item });
}
