import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createCampaign, listCampaigns } from "@/lib/services/campaigns";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const campaigns = await listCampaigns(user.id);
    return NextResponse.json({ campaigns });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load campaigns." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const campaign = await createCampaign(user.id, await request.json().catch(() => ({})));
    return NextResponse.json({ campaign });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign creation failed." }, { status: 400 });
  }
}
