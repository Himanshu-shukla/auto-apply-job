import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateFollowUpEmail } from "@/lib/services/followUps";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  try {
    const followUp = await generateFollowUpEmail(user.id, params.id);
    return NextResponse.json({ followUp });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Follow-up generation failed." }, { status: 400 });
  }
}
