import { NextRequest, NextResponse } from "next/server";
import { isAuthContext, validateExtensionRequest } from "@/lib/services/extensionAuth";
import { captureJobForUser } from "@/lib/services/extensionJobs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await validateExtensionRequest(request, 30);
  if (!isAuthContext(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const result = await captureJobForUser(auth.userId, body);
  return NextResponse.json(result);
}
