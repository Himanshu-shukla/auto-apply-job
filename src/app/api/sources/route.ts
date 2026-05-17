import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createJobSource, listJobSources } from "@/lib/services/jobSources";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const sources = await listJobSources(user.id);
  return NextResponse.json({ sources });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  const source = await createJobSource(user.id, await request.json().catch(() => ({})));
  return NextResponse.json({ source });
}
