import { NextRequest, NextResponse } from "next/server";
import { isAuthContext, validateExtensionRequest } from "@/lib/services/extensionAuth";
import { importCapturedJobsForUser } from "@/lib/services/extensionJobs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await validateExtensionRequest(request, 30);
  if (!isAuthContext(auth)) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const result = await importCapturedJobsForUser(auth.userId, body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not import jobs." }, { status: 400 });
  }
}
