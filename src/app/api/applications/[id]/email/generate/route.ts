import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateApplicationEmail } from "@/lib/services/emailApplications";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  try {
    const result = await generateApplicationEmail(user.id, params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Email generation failed." }, { status: 400 });
  }
}
