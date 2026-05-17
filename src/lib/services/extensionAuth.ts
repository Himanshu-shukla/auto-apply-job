import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { findExtensionTokenByHash, touchExtensionToken } from "@/lib/services/phase2Storage";

const TOKEN_PREFIX = "jacp";
const TOKEN_BYTES = 32;
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 60;
const buckets = new Map<string, { count: number; resetAt: number }>();

export type ExtensionAuthContext = {
  userId: string;
  tokenId: string;
};

export function generateExtensionToken(): { plainToken: string; tokenHash: string } {
  const secret = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  const plainToken = `${TOKEN_PREFIX}_${secret}`;
  return { plainToken, tokenHash: hashExtensionToken(plainToken) };
}

export function hashExtensionToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

export function maskToken(token: string): string {
  return `${token.slice(0, 9)}...${token.slice(-6)}`;
}

export function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function checkRateLimit(key: string, limit = DEFAULT_LIMIT): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export async function validateExtensionRequest(request: NextRequest, limit = DEFAULT_LIMIT): Promise<ExtensionAuthContext | NextResponse> {
  const token = getBearerToken(request);
  const remoteKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rateKey = token ? hashExtensionToken(token).slice(0, 16) : remoteKey;
  if (!checkRateLimit(rateKey, limit)) {
    return NextResponse.json({ error: "Too many extension requests. Try again shortly." }, { status: 429 });
  }
  if (!token || !token.startsWith(`${TOKEN_PREFIX}_`)) {
    return NextResponse.json({ error: "Missing or invalid extension token." }, { status: 401 });
  }

  const tokenHash = hashExtensionToken(token);
  const record = await findExtensionTokenByHash(tokenHash);
  if (!record || record.revokedAt) {
    return NextResponse.json({ error: "Extension token was not found or has been revoked." }, { status: 401 });
  }

  await touchExtensionToken(record.id);

  return { userId: record.userId, tokenId: record.id };
}

export function isAuthContext(value: ExtensionAuthContext | NextResponse): value is ExtensionAuthContext {
  return !(value instanceof NextResponse);
}
