import type { JobProvider } from "@/lib/providers/types";
import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";
import { defaultAutomationLevel } from "@/lib/services/sourcePolicy";

export class PublicAPIProvider implements JobProvider {
  sourceName = "PublicAPIProvider";
  enabled = false;
  capabilities = {
    canSearch: true,
    canCapture: true,
    canAssistedApply: true,
    canSubmit: false,
    requiresCredential: true,
    restrictedReason: "Enable a concrete official API adapter with credentials before API submit."
  };

  async searchJobs(_preferences: JobPreferenceInput): Promise<NormalizedJob[]> {
    return [];
  }

  async getJobDetails(_jobIdOrUrl: string): Promise<NormalizedJob | null> {
    return null;
  }

  normalizeJob(rawJob: unknown): NormalizedJob {
    return rawJob as NormalizedJob;
  }

  classifySource() {
    return "official_api" as const;
  }

  getAutomationLevel() {
    return defaultAutomationLevel("official_api");
  }
}
