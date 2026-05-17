import type { JobProvider } from "@/lib/providers/types";
import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";
import { defaultAutomationLevel } from "@/lib/services/sourcePolicy";

export class PartnerFeedProvider implements JobProvider {
  sourceName = "PartnerFeedProvider";
  enabled = false;
  capabilities = {
    canSearch: true,
    canCapture: true,
    canAssistedApply: true,
    canSubmit: false,
    requiresCredential: true,
    restrictedReason: "Partner feeds need a configured feed and partner terms before submission."
  };

  async searchJobs(_preferences: JobPreferenceInput): Promise<NormalizedJob[]> {
    return [];
  }

  normalizeJob(rawJob: unknown): NormalizedJob {
    return rawJob as NormalizedJob;
  }

  classifySource() {
    return "partner_feed" as const;
  }

  getAutomationLevel() {
    return defaultAutomationLevel("partner_feed");
  }
}
