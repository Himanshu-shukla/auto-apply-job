import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/services/campaigns";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const campaign = await getCampaign(user.id, params.id);
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  return NextResponse.json({ campaign });
}
