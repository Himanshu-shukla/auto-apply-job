import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";
import type { AutomationLevel, SourceType } from "@/lib/services/sourcePolicy";

export interface JobProvider<RawJob = unknown> {
  sourceName: string;
  enabled?: boolean;
  searchJobs(preferences: JobPreferenceInput): Promise<NormalizedJob[]>;
  getJobDetails?(jobIdOrUrl: string): Promise<NormalizedJob | null>;
  normalizeJob(rawJob: RawJob): NormalizedJob;
  classifySource?(job: NormalizedJob): SourceType;
  getAutomationLevel?(sourceType: SourceType, job: NormalizedJob): AutomationLevel;
}
