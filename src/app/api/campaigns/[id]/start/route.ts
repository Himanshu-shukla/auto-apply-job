import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { setCampaignStatus } from "@/lib/services/campaigns";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    const campaign = await setCampaignStatus(user.id, params.id, "running");
    return NextResponse.json({ campaign });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start campaign." }, { status: 400 });
  }
}
