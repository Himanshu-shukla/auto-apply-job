import type { NormalizedJob } from "@/lib/types";
import type { JobProvider } from "@/lib/providers/types";
import { classifySource, defaultAutomationLevel } from "@/lib/services/sourcePolicy";

export function normalizeManualJob(input: {
  title?: string;
  company?: string;
  url?: string;
  description: string;
  location?: string;
}): NormalizedJob {
  const description = input.description.trim();
  const title = input.title?.trim() || inferLine(description, /(?:role|title|position)\s*:?\s*(.+)/i) || "Manual Job";
  const company = input.company?.trim() || inferLine(description, /company\s*:?\s*(.+)/i) || "Unknown Company";

  return {
    title,
    company,
    location: input.location?.trim() || inferLine(description, /location\s*:?\s*(.+)/i) || "Not specified",
    remoteType: /remote/i.test(description) ? "REMOTE" : /hybrid/i.test(description) ? "HYBRID" : "FLEXIBLE",
    salaryMin: undefined,
    salaryMax: undefined,
    experienceRequired: Number(description.match(/(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)/i)?.[1] ?? 0) || null,
    description,
    applyUrl: input.url?.trim() || `manual:${Date.now()}`,
    source: "ManualImport",
    postedDate: new Date()
  };
}

export class ManualImportProvider implements JobProvider {
  sourceName = "ManualImport";

  async searchJobs(): Promise<NormalizedJob[]> {
    return [];
  }

  normalizeJob(rawJob: unknown): NormalizedJob {
    return rawJob as NormalizedJob;
  }

  classifySource(job: NormalizedJob) {
    return classifySource(job);
  }

  getAutomationLevel() {
    return defaultAutomationLevel("user_imported");
  }
}

function inferLine(description: string, pattern: RegExp): string | null {
  const line = description
    .split("\n")
    .map((value) => value.trim())
    .find((value) => pattern.test(value));
  return line?.match(pattern)?.[1]?.trim() ?? null;
}
