import type { JobProvider } from "@/lib/providers/types";
import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";
import { defaultAutomationLevel } from "@/lib/services/sourcePolicy";

export class DirectEmailJobProvider implements JobProvider {
  sourceName = "DirectEmailJobProvider";
  capabilities = {
    canSearch: true,
    canCapture: true,
    canAssistedApply: true,
    canSubmit: true,
    requiresCredential: false
  };

  async searchJobs(_preferences: JobPreferenceInput): Promise<NormalizedJob[]> {
    return [];
  }

  normalizeJob(rawJob: unknown): NormalizedJob {
    return rawJob as NormalizedJob;
  }

  classifySource() {
    return "direct_email" as const;
  }

  getAutomationLevel() {
    return defaultAutomationLevel("direct_email");
  }
}
