import type { AutomationLevel, SourceType } from "@/lib/services/sourcePolicy";
import { isAutomationAllowed } from "@/lib/services/sourcePolicy";

export type RiskEvaluation = {
  riskLevel: "low" | "medium" | "high";
  warnings: string[];
  allowedAction: AutomationLevel | "manual_review";
};

export function evaluateAutomationRisk(job: { sourceType?: SourceType; automationLevel?: AutomationLevel; riskFlags?: string[]; description?: string }, payload: unknown, sourceType?: SourceType): RiskEvaluation {
  const warnings: string[] = [];
  const type = sourceType ?? job.sourceType ?? "unknown";
  const level = job.automationLevel ?? "save_only";
  if (type === "restricted_platform") warnings.push("Restricted platform: auto-apply and auto-submit are blocked.");
  if (type === "unknown") warnings.push("Unknown source: save-only until reviewed.");
  if (job.riskFlags?.length) warnings.push(...job.riskFlags);
  if (!payload || JSON.stringify(payload).length < 20) warnings.push("Generated payload is incomplete.");
  if (/authorization|visa|sponsor|salary|compensation/i.test(job.description ?? "")) {
    warnings.push("Sensitive application topics may require manual review.");
  }
  const high = type === "restricted_platform" || type === "unknown";
  const autoEmail = type === "direct_email" && isAutomationAllowed(level, "auto_send_email") && !warnings.length;
  return {
    riskLevel: high ? "high" : warnings.length ? "medium" : "low",
    warnings,
    allowedAction: high ? "manual_review" : autoEmail ? "auto_send_email" : isAutomationAllowed(level, "one_click_apply") ? "one_click_apply" : "assisted_apply"
  };
}
