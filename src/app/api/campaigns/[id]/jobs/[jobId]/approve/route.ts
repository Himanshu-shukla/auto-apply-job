import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { approveCampaignJob } from "@/lib/services/campaigns";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string; jobId: string } }) {
  try {
    const user = await getCurrentUser();
    const campaign = await approveCampaignJob(user.id, params.id, params.jobId);
    return NextResponse.json({ campaign });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not approve campaign job." }, { status: 400 });
  }
}
