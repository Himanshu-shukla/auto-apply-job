import type { ExperienceLevel, JobType, RemoteType } from "@/generated/prisma/client";

export type ParsedResume = {
  name: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  workExperience: string[];
  education: string[];
  projects: string[];
  totalExperienceYears: number;
};

export type JobPreferenceInput = {
  targetRole: string;
  preferredLocations: string[];
  remotePreference: RemoteType;
  minimumSalary?: number | null;
  experienceLevel: ExperienceLevel;
  jobType: JobType;
  skillsToPrioritize: string[];
  skillsToAvoid: string[];
  sourcePreferences: string[];
};

export type NormalizedJob = {
  title: string;
  company: string;
  location: string;
  remoteType: RemoteType;
  salaryMin?: number | null;
  salaryMax?: number | null;
  experienceRequired?: number | null;
  description: string;
  applyUrl: string;
  source: string;
  sourceType?: string;
  automationLevel?: string;
  recruiterEmail?: string | null;
  riskFlags?: string[];
  postedDate?: Date | string | null;
};

export type MatchScoreResult = {
  overallScore: number;
  skillsScore: number;
  experienceScore: number;
  roleScore: number;
  locationScore: number;
  salaryScore: number;
  missingSkills: string[];
  strongMatchingPoints: string[];
  riskFactors: string[];
  aiExplanation: string;
};

export type ResumeSuggestionResult = {
  safeToAddIfTrue: string[];
  needsUserConfirmation: string[];
  missingSkillToLearn: string[];
  keywords: string[];
  improvedBullets: string[];
  weakAreas: string[];
};
