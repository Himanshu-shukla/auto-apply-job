import { prisma } from "@/lib/prisma";
import { getAutomationSetting } from "@/lib/services/settings";

export type LimitKind = "application" | "email" | "follow_up";

export async function checkDailyLimit(userId: string, kind: LimitKind, source?: string | null): Promise<{ allowed: boolean; remaining: number; limit: number; reason?: string }> {
  const setting = await getAutomationSetting(userId);
  const since = startOfDay();
  const [applicationCount, emailCount, followUpCount] = await Promise.all([
    (prisma as any).application.count({ where: { userId, automationUsed: true, submittedAt: { gte: since } } }),
    (prisma as any).emailApplication.count({ where: { userId, status: "sent", sentAt: { gte: since } } }),
    (prisma as any).followUp.count({ where: { userId, status: "sent", sentAt: { gte: since } } })
  ]);
  const counts = { application: applicationCount, email: emailCount, follow_up: followUpCount };
  const limits = {
    application: setting.maxApplicationsPerDay,
    email: setting.maxEmailsPerDay,
    follow_up: setting.maxFollowUpsPerDay
  };
  const sourceCap = sourceSpecificCap(setting.sourceCaps, source, limits[kind]);
  const limit = Math.min(limits[kind], sourceCap);
  const remaining = Math.max(0, limit - counts[kind]);
  if (remaining <= 0) {
    return { allowed: false, remaining: 0, limit, reason: `${kind.replace("_", " ")} daily limit reached.` };
  }
  return { allowed: true, remaining, limit };
}

export function evaluateDailyLimit(count: number, limit: number) {
  const remaining = Math.max(0, limit - count);
  return { allowed: remaining > 0, remaining, limit };
}

export async function checkCooldown(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const setting = await getAutomationSetting(userId);
  const since = new Date(Date.now() - setting.cooldownMinutes * 60 * 1000);
  const recent = await (prisma as any).emailApplication.findFirst({
    where: { userId, status: "sent", sentAt: { gte: since } },
    orderBy: { sentAt: "desc" }
  });
  if (recent) return { allowed: false, reason: `Wait at least ${setting.cooldownMinutes} minutes between automated sends.` };
  return { allowed: true };
}

function startOfDay(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function sourceSpecificCap(sourceCaps: unknown, source: string | null | undefined, fallback: number): number {
  if (!source || !sourceCaps || typeof sourceCaps !== "object") return fallback;
  const cap = (sourceCaps as Record<string, unknown>)[source];
  const parsed = Number(cap);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}
