import { NextRequest, NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRuleInput } from "@/lib/services/automationRules";
import { logAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getDemoUser();
  const existing = await (prisma as any).automationRule.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const rule = await (prisma as any).automationRule.update({ where: { id: params.id }, data: sanitizeRuleInput(body, existing) });
  await logAudit({ userId: user.id, action: "user_approved", entityType: "AutomationRule", entityId: rule.id, metadata: { updated: true } });
  return NextResponse.json({ rule });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getDemoUser();
  await (prisma as any).automationRule.deleteMany({ where: { id: params.id, userId: user.id } });
  await logAudit({ userId: user.id, action: "automation_blocked", entityType: "AutomationRule", entityId: params.id, metadata: { deleted: true } });
  return NextResponse.json({ ok: true });
}
