import { NextRequest, NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRuleInput } from "@/lib/services/automationRules";
import { logAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getDemoUser();
  const rules = await (prisma as any).automationRule.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  const data = sanitizeRuleInput(body);
  const rule = await (prisma as any).automationRule.create({ data: { ...data, userId: user.id } });
  await logAudit({ userId: user.id, action: "user_approved", entityType: "AutomationRule", entityId: rule.id, metadata: { created: true, enabled: rule.enabled } });
  return NextResponse.json({ rule });
}
