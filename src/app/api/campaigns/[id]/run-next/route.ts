import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runNextCampaignJob } from "@/lib/services/campaigns";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    const result = await runNextCampaignJob(user.id, params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not run campaign job." }, { status: 400 });
  }
}
