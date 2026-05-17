import type { ExperienceLevel, JobType, RemoteType } from "@/generated/prisma/client";
import type { JobPreferenceInput } from "@/lib/types";
import { splitList } from "@/lib/services/text";

export function normalizePreferences(input: Record<string, unknown>): JobPreferenceInput {
  return {
    targetRole: String(input.targetRole ?? "").trim(),
    preferredLocations: splitList(input.preferredLocations as string | string[]),
    remotePreference: normalizeEnum(input.remotePreference, ["REMOTE", "HYBRID", "ONSITE", "FLEXIBLE"], "FLEXIBLE"),
    minimumSalary: normalizeNullableNumber(input.minimumSalary),
    experienceLevel: normalizeEnum(input.experienceLevel, ["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD"], "MID"),
    jobType: normalizeEnum(input.jobType, ["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT"], "FULL_TIME"),
    skillsToPrioritize: splitList(input.skillsToPrioritize as string | string[]),
    skillsToAvoid: splitList(input.skillsToAvoid as string | string[]),
    sourcePreferences: splitList(input.sourcePreferences as string | string[])
  };
}

function normalizeNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeEnum<T extends RemoteType | ExperienceLevel | JobType>(
  value: unknown,
  allowed: T[],
  fallback: T
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}
