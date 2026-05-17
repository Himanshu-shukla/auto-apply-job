import type { JobProvider } from "@/lib/providers/types";
import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";
import { defaultAutomationLevel } from "@/lib/services/sourcePolicy";

export class CompanyCareerPageProvider implements JobProvider {
  sourceName = "CompanyCareerPageProvider";
  capabilities = {
    canSearch: true,
    canCapture: true,
    canAssistedApply: true,
    canSubmit: false,
    requiresCredential: false,
    restrictedReason: "Company career pages use the extension state machine; final submit requires an explicitly allowed domain."
  };

  constructor(private allowedDomains: string[] = []) {}

  async searchJobs(_preferences: JobPreferenceInput): Promise<NormalizedJob[]> {
    return [];
  }

  normalizeJob(rawJob: unknown): NormalizedJob {
    return rawJob as NormalizedJob;
  }

  classifySource() {
    return "company_career_page" as const;
  }

  getAutomationLevel() {
    return this.allowedDomains.length ? "one_click_apply" as const : defaultAutomationLevel("company_career_page");
  }
}
