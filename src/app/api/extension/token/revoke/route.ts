import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { revokeExtensionTokens } from "@/lib/services/phase2Storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  const body = await request.json().catch(() => ({}));
  const count = await revokeExtensionTokens(user.id, body.id ? String(body.id) : undefined);

  return NextResponse.json({ revoked: count });
}
