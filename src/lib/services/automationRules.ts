import { prisma } from "@/lib/prisma";
import type { AutomationLevel, SourceType } from "@/lib/services/sourcePolicy";
import { isAutomationAllowed } from "@/lib/services/sourcePolicy";

export type ApprovalMode = "manual_review" | "one_click_approve" | "allowed_source_auto_send_only";

export type AutomationRuleInput = {
  name: string;
  targetTitles: string[];
  locations: string[];
  remotePreference: "REMOTE" | "HYBRID" | "ONSITE" | "FLEXIBLE";
  minMatchScore: number;
  minSalary?: number | null;
  requiredSkills: string[];
  excludedCompanies: string[];
  excludedKeywords: string[];
  maxApplicationsPerDay: number;
  approvalMode: ApprovalMode;
  enabled: boolean;
};

export type JobForRule = {
  title: string;
  company: string;
  location: string;
  remoteType: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  description: string;
  sourceType?: SourceType;
  automationLevel?: AutomationLevel;
  matches?: Array<{ overallScore: number }>;
};

export function sanitizeRuleInput(body: Record<string, unknown>, existing?: Partial<AutomationRuleInput>): AutomationRuleInput {
  return {
    name: stringValue(body.name, existing?.name ?? "Automation rule"),
    targetTitles: listValue(body.targetTitles, existing?.targetTitles),
    locations: listValue(body.locations, existing?.locations),
    remotePreference: enumValue(body.remotePreference, ["REMOTE", "HYBRID", "ONSITE", "FLEXIBLE"], existing?.remotePreference ?? "FLEXIBLE"),
    minMatchScore: clampInt(body.minMatchScore, existing?.minMatchScore ?? 70, 0, 100),
    minSalary: nullableInt(body.minSalary, existing?.minSalary ?? null),
    requiredSkills: listValue(body.requiredSkills, existing?.requiredSkills),
    excludedCompanies: listValue(body.excludedCompanies, existing?.excludedCompanies),
    excludedKeywords: listValue(body.excludedKeywords, existing?.excludedKeywords),
    maxApplicationsPerDay: clampInt(body.maxApplicationsPerDay, existing?.maxApplicationsPerDay ?? 10, 1, 50),
    approvalMode: enumValue(body.approvalMode, ["manual_review", "one_click_approve", "allowed_source_auto_send_only"], existing?.approvalMode ?? "manual_review"),
    enabled: typeof body.enabled === "boolean" ? body.enabled : existing?.enabled ?? true
  };
}

export function evaluateAutomationRule(rule: AutomationRuleInput, job: JobForRule): { matched: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!rule.enabled) return { matched: false, reasons: ["Rule is disabled."] };

  const titleText = job.title.toLowerCase();
  if (rule.targetTitles.length && !rule.targetTitles.some((title) => titleText.includes(title.toLowerCase()))) {
    reasons.push("Job title does not match target titles.");
  }
  if (rule.locations.length && !rule.locations.some((location) => job.location.toLowerCase().includes(location.toLowerCase()))) {
    reasons.push("Location is outside the rule target.");
  }
  if (rule.remotePreference !== "FLEXIBLE" && job.remoteType !== rule.remotePreference) {
    reasons.push("Remote preference does not match.");
  }
  const score = job.matches?.[0]?.overallScore ?? 0;
  if (score < rule.minMatchScore) reasons.push(`Match score ${score} is below ${rule.minMatchScore}.`);
  const salary = job.salaryMax ?? job.salaryMin ?? 0;
  if (rule.minSalary && salary && salary < rule.minSalary) reasons.push("Salary is below the rule minimum.");
  if (rule.excludedCompanies.some((company) => job.company.toLowerCase().includes(company.toLowerCase()))) {
    reasons.push("Company is excluded.");
  }
  const searchable = `${job.title} ${job.company} ${job.location} ${job.description}`.toLowerCase();
  if (rule.excludedKeywords.some((keyword) => searchable.includes(keyword.toLowerCase()))) {
    reasons.push("Job contains excluded keywords.");
  }
  if (rule.requiredSkills.some((skill) => !searchable.includes(skill.toLowerCase()))) {
    reasons.push("Missing one or more required skills.");
  }
  if (!safeSourceForRule(job.sourceType, job.automationLevel)) {
    reasons.push("Source policy does not allow automation for this job.");
  }
  return { matched: reasons.length === 0, reasons };
}

export function safeSourceForRule(sourceType?: SourceType, automationLevel?: AutomationLevel): boolean {
  if (!sourceType || sourceType === "restricted_platform" || sourceType === "unknown") return false;
  if (!automationLevel) return false;
  return isAutomationAllowed(automationLevel, "assisted_apply");
}

export async function listRules(userId: string) {
  return (prisma as any).automationRule.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : fallback;
}

function listValue(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 50);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 50);
  return fallback;
}

function enumValue<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function nullableInt(value: unknown, fallback: number | null): number | null {
  if (value === null || value === "" || typeof value === "undefined") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}
