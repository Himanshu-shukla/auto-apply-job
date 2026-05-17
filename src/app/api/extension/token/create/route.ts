import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { generateExtensionToken, maskToken } from "@/lib/services/extensionAuth";
import { createExtensionTokenRecord } from "@/lib/services/phase2Storage";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getDemoUser();
  const { plainToken, tokenHash } = generateExtensionToken();
  const record = await createExtensionTokenRecord(user.id, tokenHash);

  return NextResponse.json({
    token: plainToken,
    tokenPreview: maskToken(plainToken),
    tokenRecord: {
      id: record.id,
      createdAt: record.createdAt,
      revokedAt: record.revokedAt,
      lastUsedAt: record.lastUsedAt
    }
  });
}
