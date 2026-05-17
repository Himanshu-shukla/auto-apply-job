import type { JobProvider, SubmitApplicationInput, SubmitApplicationResult } from "@/lib/providers/types";
import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  content?: string;
  location?: { name?: string };
  updated_at?: string;
};

export class GreenhouseProvider implements JobProvider<GreenhouseJob> {
  sourceName = "Greenhouse";
  capabilities = {
    canSearch: true,
    canCapture: true,
    canAssistedApply: true,
    canSubmit: Boolean(process.env.GREENHOUSE_JOB_BOARD_API_KEY),
    requiresCredential: true,
    restrictedReason: process.env.GREENHOUSE_JOB_BOARD_API_KEY ? undefined : "Greenhouse submit requires an official Job Board API key."
  };

  async searchJobs(preferences: JobPreferenceInput): Promise<NormalizedJob[]> {
    const boardTokens = csv(process.env.GREENHOUSE_BOARD_TOKENS);
    if (!boardTokens.length) return [];
    const results = await Promise.all(boardTokens.map((token) => this.fetchBoard(token, preferences).catch(() => [])));
    return results.flat();
  }

  async getJobDetails(jobIdOrUrl: string): Promise<NormalizedJob | null> {
    const parsed = parseGreenhouseUrl(jobIdOrUrl);
    if (!parsed) return null;
    const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${parsed.boardToken}/jobs/${parsed.jobId}`);
    if (!response.ok) return null;
    return this.normalizeJob(await response.json());
  }

  async submitApplication(input: SubmitApplicationInput): Promise<SubmitApplicationResult> {
    const apiKey = process.env.GREENHOUSE_JOB_BOARD_API_KEY;
    const parsed = parseGreenhouseUrl(input.job.applyUrl);
    if (!apiKey || !parsed) {
      return { submitted: false, provider: this.sourceName, message: "Greenhouse API key or job URL is not configured." };
    }
    const applicant = input.applicant;
    const name = String(applicant.fullName ?? applicant.name ?? "").trim();
    const [firstName, ...lastNameParts] = name.split(/\s+/);
    const payload = {
      first_name: firstName || "Candidate",
      last_name: lastNameParts.join(" ") || "Applicant",
      email: String(applicant.email ?? ""),
      phone: String(applicant.phone ?? ""),
      resume_text: input.resume?.text ?? "",
      cover_letter_text: input.coverLetter?.text ?? "",
      source: "Job Copilot Campaign"
    };
    const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${parsed.boardToken}/jobs/${parsed.jobId}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const raw = await response.json().catch(() => ({}));
    return {
      submitted: response.ok,
      provider: this.sourceName,
      externalId: typeof raw.id === "string" ? raw.id : null,
      message: response.ok ? "Submitted through Greenhouse Job Board API." : `Greenhouse submit failed with ${response.status}.`,
      raw
    };
  }

  normalizeJob(rawJob: GreenhouseJob): NormalizedJob {
    const description = stripHtml(rawJob.content || rawJob.title || "");
    return {
      title: rawJob.title || "Greenhouse Job",
      company: inferCompany(rawJob.absolute_url, "Greenhouse Company"),
      location: rawJob.location?.name || "Not specified",
      remoteType: /remote/i.test(`${rawJob.location?.name ?? ""} ${description}`) ? "REMOTE" : "FLEXIBLE",
      salaryMin: null,
      salaryMax: null,
      experienceRequired: Number(description.match(/(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)/i)?.[1] ?? 0) || null,
      description,
      applyUrl: rawJob.absolute_url,
      source: this.sourceName,
      sourceType: "official_api",
      automationLevel: this.capabilities.canSubmit ? "api_apply" : "save_only",
      postedDate: rawJob.updated_at ?? new Date().toISOString()
    };
  }

  classifySource() {
    return "official_api" as const;
  }

  getAutomationLevel() {
    return this.capabilities.canSubmit ? "api_apply" as const : "save_only" as const;
  }

  private async fetchBoard(boardToken: string, preferences: JobPreferenceInput): Promise<NormalizedJob[]> {
    const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`);
    if (!response.ok) throw new Error(`Greenhouse board ${boardToken} failed: ${response.status}`);
    const data = await response.json();
    return ((data.jobs ?? []) as GreenhouseJob[]).map((job) => this.normalizeJob(job)).filter((job) => matchesPreferences(job, preferences)).slice(0, 100);
  }
}

function parseGreenhouseUrl(url: string): { boardToken: string; jobId: string } | null {
  const match = url.match(/boards\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i) || url.match(/greenhouse\.io\/v1\/boards\/([^/]+)\/jobs\/(\d+)/i);
  return match ? { boardToken: match[1], jobId: match[2] } : null;
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
  return url.match(/boards\.greenhouse\.io\/([^/]+)/i)?.[1] ?? fallback;
}
