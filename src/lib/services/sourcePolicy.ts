import type { NormalizedJob } from "@/lib/types";

export type SourceType =
  | "restricted_platform"
  | "official_api"
  | "company_career_page"
  | "direct_email"
  | "user_imported"
  | "partner_feed"
  | "unknown";

export type AutomationLevel =
  | "view_only"
  | "save_only"
  | "assisted_apply"
  | "one_click_apply"
  | "auto_send_email"
  | "api_apply";

export const automationOrder: AutomationLevel[] = [
  "view_only",
  "save_only",
  "assisted_apply",
  "one_click_apply",
  "auto_send_email",
  "api_apply"
];

const restrictedDomains = ["linkedin.", "indeed.", "glassdoor.", "naukri.", "monster.", "ziprecruiter.", "dice."];
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function normalizeDomain(value?: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return value.replace(/^www\./, "").toLowerCase().trim() || null;
  }
}

export function detectRecruiterEmail(text: string): string | null {
  return text.match(emailPattern)?.[0] ?? null;
}

export function classifySource(job: Pick<NormalizedJob, "source" | "applyUrl" | "description"> & { recruiterEmail?: string | null }): SourceType {
  const source = job.source.toLowerCase();
  const urlDomain = normalizeDomain(job.applyUrl);
  const haystack = `${source} ${job.applyUrl} ${job.description}`.toLowerCase();
  if (restrictedDomains.some((domain) => haystack.includes(domain))) return "restricted_platform";
  if (source.includes("officialapi") || source.includes("official api")) return "official_api";
  if (source.includes("partner")) return "partner_feed";
  if (source.includes("manual") || job.applyUrl.startsWith("manual:")) return "user_imported";
  if (job.recruiterEmail || detectRecruiterEmail(job.description) || /^mailto:/i.test(job.applyUrl)) return "direct_email";
  if (urlDomain && (source.includes("career") || /\/careers?|\/jobs?/.test(job.applyUrl))) return "company_career_page";
  if (source.includes("rss")) return "partner_feed";
  return "unknown";
}

export function defaultAutomationLevel(sourceType: SourceType): AutomationLevel {
  switch (sourceType) {
    case "restricted_platform":
      return "assisted_apply";
    case "official_api":
      return "save_only";
    case "company_career_page":
      return "assisted_apply";
    case "direct_email":
      return "assisted_apply";
    case "user_imported":
      return "assisted_apply";
    case "partner_feed":
      return "save_only";
    default:
      return "save_only";
  }
}

export function enforceSourceAutomationLevel(input: {
  sourceType: SourceType;
  requestedLevel?: AutomationLevel | null;
  configuredLevel?: AutomationLevel | null;
  hasOfficialCredentials?: boolean;
  companyDomainAllowed?: boolean;
  directEmailApproved?: boolean;
}): AutomationLevel {
  const requested = input.requestedLevel ?? input.configuredLevel ?? defaultAutomationLevel(input.sourceType);
  if (input.sourceType === "restricted_platform") return minLevel(requested, "assisted_apply");
  if (input.sourceType === "unknown") return minLevel(requested, "save_only");
  if (input.sourceType === "direct_email") {
    return input.directEmailApproved ? minLevel(requested, "auto_send_email") : minLevel(requested, "assisted_apply");
  }
  if (input.sourceType === "official_api") {
    return input.hasOfficialCredentials ? minLevel(requested, "api_apply") : minLevel(requested, "save_only");
  }
  if (input.sourceType === "company_career_page") {
    return input.companyDomainAllowed ? minLevel(requested, "one_click_apply") : minLevel(requested, "assisted_apply");
  }
  return minLevel(requested, "assisted_apply");
}

export function isAutomationAllowed(level: AutomationLevel, action: AutomationLevel): boolean {
  return automationOrder.indexOf(level) >= automationOrder.indexOf(action);
}

export function minLevel(a: AutomationLevel, b: AutomationLevel): AutomationLevel {
  return automationOrder[Math.min(automationOrder.indexOf(a), automationOrder.indexOf(b))] ?? "save_only";
}

export function sourcePolicyWarning(sourceType: SourceType, level: AutomationLevel): string | null {
  if (sourceType === "restricted_platform" && automationOrder.indexOf(level) > automationOrder.indexOf("assisted_apply")) {
    return "Restricted platforms are limited to assisted apply. Auto-submit is blocked.";
  }
  if (sourceType === "unknown" && level !== "save_only" && level !== "view_only") {
    return "Unknown sources are save-only until classified.";
  }
  return null;
}
