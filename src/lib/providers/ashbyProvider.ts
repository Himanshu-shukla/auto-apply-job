import type { JobProvider } from "@/lib/providers/types";
import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";

type AshbyJob = {
  title: string;
  location?: string;
  isRemote?: boolean;
  workplaceType?: "OnSite" | "Remote" | "Hybrid";
  descriptionPlain?: string;
  descriptionHtml?: string;
  publishedAt?: string;
  employmentType?: string;
  jobUrl: string;
  applyUrl: string;
  compensation?: { scrapeableCompensationSalarySummary?: string };
};

export class AshbyProvider implements JobProvider<AshbyJob> {
  sourceName = "Ashby";
  capabilities = {
    canSearch: true,
    canCapture: true,
    canAssistedApply: true,
    canSubmit: false,
    requiresCredential: false,
    restrictedReason: "Ashby public postings expose search/capture; submission remains hosted-form assisted unless a partner integration is added."
  };

  async searchJobs(preferences: JobPreferenceInput): Promise<NormalizedJob[]> {
    const boards = csv(process.env.ASHBY_BOARD_NAMES);
    if (!boards.length) return [];
    const results = await Promise.all(boards.map((board) => this.fetchBoard(board, preferences).catch(() => [])));
    return results.flat();
  }

  normalizeJob(rawJob: AshbyJob): NormalizedJob {
    const description = rawJob.descriptionPlain || stripHtml(rawJob.descriptionHtml ?? rawJob.title);
    return {
      title: rawJob.title || "Ashby Job",
      company: inferCompany(rawJob.jobUrl, "Ashby Company"),
      location: rawJob.location || "Not specified",
      remoteType: rawJob.workplaceType === "Remote" || rawJob.isRemote ? "REMOTE" : rawJob.workplaceType === "Hybrid" ? "HYBRID" : rawJob.workplaceType === "OnSite" ? "ONSITE" : "FLEXIBLE",
      salaryMin: null,
      salaryMax: null,
      experienceRequired: Number(description.match(/(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)/i)?.[1] ?? 0) || null,
      description,
      applyUrl: rawJob.applyUrl || rawJob.jobUrl,
      source: this.sourceName,
      sourceType: "company_career_page",
      automationLevel: "assisted_apply",
      postedDate: rawJob.publishedAt ?? new Date().toISOString()
    };
  }

  classifySource() {
    return "company_career_page" as const;
  }

  getAutomationLevel() {
    return "assisted_apply" as const;
  }

  private async fetchBoard(board: string, preferences: JobPreferenceInput): Promise<NormalizedJob[]> {
    const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`);
    if (!response.ok) throw new Error(`Ashby board ${board} failed: ${response.status}`);
    const data = await response.json();
    return ((data.jobs ?? []) as AshbyJob[]).map((job) => this.normalizeJob(job)).filter((job) => matchesPreferences(job, preferences)).slice(0, 100);
  }
}

function matchesPreferences(job: NormalizedJob, preferences: JobPreferenceInput): boolean {
  const terms = [preferences.targetRole, ...preferences.skillsToPrioritize].map((term) => term.toLowerCase()).filter(Boolean);
  if (!terms.length) return true;
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function csv(value?: string): string[] {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function inferCompany(url: string, fallback: string): string {
  return url.match(/ashbyhq\.com\/([^/]+)/i)?.[1] ?? fallback;
}
