import type { JobProvider } from "@/lib/providers/types";
import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";
import { defaultAutomationLevel } from "@/lib/services/sourcePolicy";

export class PublicCareerPageProvider implements JobProvider {
  sourceName = "PublicCareerPage";
  capabilities = {
    canSearch: true,
    canCapture: true,
    canAssistedApply: true,
    canSubmit: false,
    requiresCredential: false,
    restrictedReason: "Public career pages are extension-assisted unless the domain is explicitly allowed."
  };

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
    return defaultAutomationLevel("company_career_page");
  }
}
