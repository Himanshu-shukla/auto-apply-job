import { prisma } from "@/lib/prisma";

export async function getAutomationSetting(userId: string) {
  return (prisma as any).automationSetting.upsert({
    where: { userId },
    update: {},
    create: { userId }
  });
}

export async function updateAutomationSetting(userId: string, body: Record<string, unknown>) {
  const current = await getAutomationSetting(userId);
  return (prisma as any).automationSetting.update({
    where: { userId },
    data: {
      automationEnabled: typeof body.automationEnabled === "boolean" ? body.automationEnabled : current.automationEnabled,
      approvalMode: enumValue(body.approvalMode, ["manual_review", "one_click_approve", "allowed_source_auto_send_only"], current.approvalMode),
      maxApplicationsPerDay: intValue(body.maxApplicationsPerDay, current.maxApplicationsPerDay, 1, 50),
      maxEmailsPerDay: intValue(body.maxEmailsPerDay, current.maxEmailsPerDay, 1, 50),
      maxFollowUpsPerDay: intValue(body.maxFollowUpsPerDay, current.maxFollowUpsPerDay, 1, 25),
      cooldownMinutes: intValue(body.cooldownMinutes, current.cooldownMinutes, 3, 120),
      blockedCompanies: listValue(body.blockedCompanies, current.blockedCompanies),
      blockedKeywords: listValue(body.blockedKeywords, current.blockedKeywords),
      sourceCaps: typeof body.sourceCaps === "object" && body.sourceCaps ? body.sourceCaps : current.sourceCaps,
      strictTruthfulness: typeof body.strictTruthfulness === "boolean" ? body.strictTruthfulness : current.strictTruthfulness,
      aiTone: enumValue(body.aiTone, ["concise", "confident", "professional"], current.aiTone),
      coverLetterLength: enumValue(body.coverLetterLength, ["short", "medium", "long"], current.coverLetterLength),
      answerLength: enumValue(body.answerLength, ["concise", "medium", "detailed"], current.answerLength)
    }
  });
}

export async function getEmailSetting(userId: string) {
  return (prisma as any).emailSetting.upsert({
    where: { userId },
    update: {},
    create: { userId }
  });
}

export async function updateEmailSetting(userId: string, body: Record<string, unknown>) {
  const current = await getEmailSetting(userId);
  return (prisma as any).emailSetting.update({
    where: { userId },
    data: {
      senderName: stringOrNull(body.senderName, current.senderName),
      emailSignature: stringValue(body.emailSignature, current.emailSignature, 2000),
      defaultSubjectTemplate: stringValue(body.defaultSubjectTemplate, current.defaultSubjectTemplate, 200),
      followUpTemplate: stringValue(body.followUpTemplate, current.followUpTemplate, 2000),
      replyToEmail: stringOrNull(body.replyToEmail, current.replyToEmail)
    }
  });
}

function listValue(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 100);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 100);
  return fallback;
}

function intValue(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function enumValue<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function stringValue(value: unknown, fallback: string, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : fallback;
}

function stringOrNull(value: unknown, fallback: string | null): string | null {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}
