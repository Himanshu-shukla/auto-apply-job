import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { listEmailApplications } from "@/lib/services/emailApplications";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getDemoUser();
  const emails = await listEmailApplications(user.id, params.id);
  return NextResponse.json({ emails });
}
