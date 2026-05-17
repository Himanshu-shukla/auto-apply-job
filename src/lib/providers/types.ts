import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";
import type { AutomationLevel, SourceType } from "@/lib/services/sourcePolicy";

export type ProviderCapabilities = {
  canSearch: boolean;
  canCapture: boolean;
  canAssistedApply: boolean;
  canSubmit: boolean;
  requiresCredential: boolean;
  restrictedReason?: string;
};

export type ApplicationSchemaField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "email" | "phone" | "url" | "file" | "select" | "checkbox";
  required: boolean;
  options?: string[];
};

export type ApplicationSchema = {
  provider: string;
  jobIdOrUrl: string;
  fields: ApplicationSchemaField[];
};

export type SubmitApplicationInput = {
  userId: string;
  job: NormalizedJob & { id?: string };
  applicant: Record<string, unknown>;
  resume?: { name: string; url?: string | null; text?: string | null; contentBase64?: string | null };
  coverLetter?: { text: string; name?: string };
  answers?: Array<{ question: string; answer: string }>;
  consentAt: string;
  campaignId?: string | null;
  sourcePolicySnapshot: Record<string, unknown>;
};

export type SubmitApplicationResult = {
  submitted: boolean;
  provider: string;
  externalId?: string | null;
  message: string;
  raw?: unknown;
};

export interface JobProvider<RawJob = unknown> {
  sourceName: string;
  enabled?: boolean;
  capabilities?: ProviderCapabilities;
  searchJobs(preferences: JobPreferenceInput): Promise<NormalizedJob[]>;
  getJobDetails?(jobIdOrUrl: string): Promise<NormalizedJob | null>;
  getApplicationSchema?(jobIdOrUrl: string): Promise<ApplicationSchema | null>;
  submitApplication?(input: SubmitApplicationInput): Promise<SubmitApplicationResult>;
  normalizeJob(rawJob: RawJob): NormalizedJob;
  classifySource?(job: NormalizedJob): SourceType;
  getAutomationLevel?(sourceType: SourceType, job: NormalizedJob): AutomationLevel;
}
