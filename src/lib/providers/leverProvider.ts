import type { JobProvider, SubmitApplicationInput, SubmitApplicationResult } from "@/lib/providers/types";
import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl: string;
  descriptionPlain?: string;
  descriptionBodyPlain?: string;
  additionalPlain?: string;
  categories?: { location?: string; team?: string; commitment?: string };
  workplaceType?: "unspecified" | "on-site" | "remote" | "hybrid";
  createdAt?: number;
};

export class LeverProvider implements JobProvider<LeverPosting> {
  sourceName = "Lever";
  capabilities = {
    canSearch: true,
    canCapture: true,
    canAssistedApply: true,
    canSubmit: Boolean(process.env.LEVER_API_KEY),
    requiresCredential: true,
    restrictedReason: process.env.LEVER_API_KEY ? undefined : "Lever API submit requires an official postings API key."
  };

  async searchJobs(preferences: JobPreferenceInput): Promise<NormalizedJob[]> {
    const sites = csv(process.env.LEVER_SITE_NAMES);
    if (!sites.length) return [];
    const results = await Promise.all(sites.map((site) => this.fetchSite(site, preferences).catch(() => [])));
    return results.flat();
  }

  async submitApplication(input: SubmitApplicationInput): Promise<SubmitApplicationResult> {
    const apiKey = process.env.LEVER_API_KEY;
    const parsed = parseLeverUrl(input.job.applyUrl);
    if (!apiKey || !parsed) return { submitted: false, provider: this.sourceName, message: "Lever API key or posting URL is not configured." };
    const applicant = input.applicant;
    const payload = {
      name: String(applicant.fullName ?? applicant.name ?? "Candidate"),
      email: String(applicant.email ?? ""),
      phone: String(applicant.phone ?? ""),
      urls: [applicant.linkedIn, applicant.portfolio, applicant.github].filter(Boolean),
      comments: [input.coverLetter?.text, ...((input.answers ?? []).map((item) => `${item.question}\n${item.answer}`))].filter(Boolean).join("\n\n")
    };
    const response = await fetch(`https://api.lever.co/v0/postings/${parsed.site}/${parsed.postingId}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const raw = await response.json().catch(() => ({}));
    return {
      submitted: response.ok,
      provider: this.sourceName,
      externalId: typeof raw.id === "string" ? raw.id : null,
      message: response.ok ? "Submitted through Lever Postings API." : `Lever submit failed with ${response.status}.`,
      raw
    };
  }

  normalizeJob(rawJob: LeverPosting): NormalizedJob {
    const description = [rawJob.descriptionPlain, rawJob.descriptionBodyPlain, rawJob.additionalPlain].filter(Boolean).join("\n\n") || rawJob.text;
    return {
      title: rawJob.text || "Lever Job",
      company: inferCompany(rawJob.hostedUrl, "Lever Company"),
      location: rawJob.categories?.location || "Not specified",
      remoteType: rawJob.workplaceType === "remote" ? "REMOTE" : rawJob.workplaceType === "hybrid" ? "HYBRID" : rawJob.workplaceType === "on-site" ? "ONSITE" : "FLEXIBLE",
      salaryMin: null,
      salaryMax: null,
      experienceRequired: Number(description.match(/(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)/i)?.[1] ?? 0) || null,
      description,
      applyUrl: rawJob.applyUrl || rawJob.hostedUrl,
      source: this.sourceName,
      sourceType: "official_api",
      automationLevel: this.capabilities.canSubmit ? "api_apply" : "save_only",
      postedDate: rawJob.createdAt ? new Date(rawJob.createdAt).toISOString() : new Date().toISOString()
    };
  }

  classifySource() {
    return "official_api" as const;
  }

  getAutomationLevel() {
    return this.capabilities.canSubmit ? "api_apply" as const : "save_only" as const;
  }

  private async fetchSite(site: string, preferences: JobPreferenceInput): Promise<NormalizedJob[]> {
    const response = await fetch(`https://api.lever.co/v0/postings/${site}?mode=json`);
    if (!response.ok) throw new Error(`Lever site ${site} failed: ${response.status}`);
    const jobs = (await response.json()) as LeverPosting[];
    return jobs.map((job) => this.normalizeJob(job)).filter((job) => matchesPreferences(job, preferences)).slice(0, 100);
  }
}

function parseLeverUrl(url: string): { site: string; postingId: string } | null {
  const match = url.match(/jobs(?:\.eu)?\.lever\.co\/([^/]+)\/([a-z0-9-]+)/i) || url.match(/api(?:\.eu)?\.lever\.co\/v0\/postings\/([^/]+)\/([a-z0-9-]+)/i);
  return match ? { site: match[1], postingId: match[2] } : null;
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

function inferCompany(url: string, fallback: string): string {
  return url.match(/lever\.co\/([^/]+)/i)?.[1] ?? fallback;
}
