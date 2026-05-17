import type { JobProvider } from "@/lib/providers/types";
import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";
import { defaultAutomationLevel } from "@/lib/services/sourcePolicy";

export class PartnerFeedProvider implements JobProvider {
  sourceName = "PartnerFeedProvider";
  enabled = false;

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
