import type { JobProvider } from "@/lib/providers/types";
import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";

const restrictedReason =
  "No official approved API access is configured. This platform is capture/link/assisted-apply only; auto-submit remains blocked.";

export class RestrictedPlatformProvider implements JobProvider {
  enabled = true;
  capabilities = {
    canSearch: false,
    canCapture: true,
    canAssistedApply: true,
    canSubmit: false,
    requiresCredential: true,
    restrictedReason
  };

  constructor(public sourceName: string) {}

  async searchJobs(_preferences: JobPreferenceInput): Promise<NormalizedJob[]> {
    return [];
  }

  normalizeJob(rawJob: unknown): NormalizedJob {
    const job = rawJob as NormalizedJob;
    return {
      ...job,
      source: this.sourceName,
      sourceType: "restricted_platform",
      automationLevel: "assisted_apply",
      riskFlags: [...(job.riskFlags ?? []), restrictedReason]
    };
  }

  classifySource() {
    return "restricted_platform" as const;
  }

  getAutomationLevel() {
    return "assisted_apply" as const;
  }
}

export function getRestrictedPlatformProviders(): JobProvider[] {
  return ["LinkedIn", "Indeed", "Glassdoor", "ZipRecruiter"].map((name) => new RestrictedPlatformProvider(name));
}
