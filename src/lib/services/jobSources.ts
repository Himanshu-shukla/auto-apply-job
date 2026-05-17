import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/services/audit";
import {
  type AutomationLevel,
  type SourceType,
  defaultAutomationLevel,
  enforceSourceAutomationLevel,
  normalizeDomain
} from "@/lib/services/sourcePolicy";

export function sanitizeSourceInput(body: Record<string, unknown>, existing?: any) {
  const sourceType = enumValue<SourceType>(body.sourceType, ["restricted_platform", "official_api", "company_career_page", "direct_email", "user_imported", "partner_feed", "unknown"], existing?.sourceType ?? "unknown");
  const requestedLevel = enumValue<AutomationLevel>(body.automationLevel, ["view_only", "save_only", "assisted_apply", "one_click_apply", "auto_send_email", "api_apply"], existing?.automationLevel ?? defaultAutomationLevel(sourceType));
  const domain = normalizeDomain(typeof body.domain === "string" ? body.domain : existing?.domain);
  const level = enforceSourceAutomationLevel({
    sourceType,
    requestedLevel,
    companyDomainAllowed: sourceType === "company_career_page" && Boolean(domain) && body.explicitlyAllowed === true,
    directEmailApproved: sourceType === "direct_email" && body.explicitlyAllowed === true,
    hasOfficialCredentials: sourceType === "official_api" && body.hasOfficialCredentials === true
  });
  return {
    name: stringValue(body.name, existing?.name ?? "Job source"),
    sourceType,
    domain,
    baseUrl: typeof body.baseUrl === "string" && body.baseUrl.trim() ? body.baseUrl.trim().slice(0, 500) : existing?.baseUrl ?? null,
    automationLevel: level,
    enabled: typeof body.enabled === "boolean" ? body.enabled : existing?.enabled ?? true
  };
}

export async function listJobSources(userId: string) {
  return (prisma as any).jobSource.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
}

export async function createJobSource(userId: string, body: Record<string, unknown>) {
  const data = sanitizeSourceInput(body);
  const source = await (prisma as any).jobSource.create({ data: { ...data, userId } });
  await logAudit({ userId, action: "job_imported", entityType: "JobSource", entityId: source.id, source: source.name, metadata: { sourceType: source.sourceType, automationLevel: source.automationLevel } });
  return source;
}

export async function updateJobSource(userId: string, id: string, body: Record<string, unknown>) {
  const existing = await (prisma as any).jobSource.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Source not found.");
  const data = sanitizeSourceInput(body, existing);
  const source = await (prisma as any).jobSource.update({ where: { id }, data });
  await logAudit({ userId, action: "job_imported", entityType: "JobSource", entityId: id, source: source.name, metadata: { updated: true } });
  return source;
}

export async function matchConfiguredSource(userId: string, url?: string | null) {
  const domain = normalizeDomain(url);
  if (!domain) return null;
  const sources = await (prisma as any).jobSource.findMany({ where: { userId, enabled: true } });
  return sources.find((source: any) => source.domain && domain.endsWith(source.domain)) ?? null;
}

export async function logProviderRun(input: { userId: string; provider: string; status: string; imported?: number; failedReason?: string | null; metadata?: unknown }) {
  return (prisma as any).providerRunLog.create({
    data: {
      userId: input.userId,
      provider: input.provider,
      status: input.status,
      imported: input.imported ?? 0,
      failedReason: input.failedReason ?? null,
      metadata: input.metadata ?? {}
    }
  });
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : fallback;
}

function enumValue<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}
