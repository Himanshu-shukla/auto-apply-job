import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ParsedResume } from "@/lib/types";

const text = z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((value) => String(value ?? "").trim());
const jsonList = z.union([z.array(z.unknown()), z.string(), z.null(), z.undefined()]).transform((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : linesToItems(value);
  } catch {
    return linesToItems(value);
  }
});

const profileInput = z.object({
  fullName: text,
  email: text,
  phone: text,
  currentLocation: text,
  targetRole: text,
  expectedSalary: text,
  availability: text,
  workAuthorization: text,
  visaStatus: text,
  linkedIn: text,
  portfolio: text,
  github: text,
  preferredResumeId: text.optional(),
  workHistory: jsonList,
  education: jsonList,
  certificates: jsonList,
  customAnswers: jsonList
}).partial();

export type ApplicantProfileInput = z.input<typeof profileInput>;

export async function getApplicantProfile(userId: string) {
  return (prisma as any).applicantProfile.findUnique({ where: { userId } });
}

export async function getOrCreateApplicantProfile(userId: string) {
  const [existing, user, resume, preferences] = await Promise.all([
    getApplicantProfile(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
    prisma.resume.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "desc" } }),
    prisma.jobPreference.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } })
  ]);
  if (existing) return existing;

  const parsed = resume?.parsedJson as ParsedResume | undefined;
  return (prisma as any).applicantProfile.create({
    data: {
      userId,
      fullName: parsed?.name || user?.name || "",
      email: parsed?.email || user?.email || "",
      phone: parsed?.phone || "",
      currentLocation: parsed?.location || "",
      targetRole: preferences?.targetRole || "",
      expectedSalary: preferences?.minimumSalary ? String(preferences.minimumSalary) : "",
      preferredResumeId: resume?.id ?? null,
      workHistory: parsed?.workExperience ?? [],
      education: parsed?.education ?? [],
      certificates: [],
      customAnswers: []
    }
  });
}

export async function updateApplicantProfile(userId: string, input: ApplicantProfileInput) {
  const data = normalizeApplicantProfileInput(input);
  await getOrCreateApplicantProfile(userId);
  return (prisma as any).applicantProfile.update({
    where: { userId },
    data
  });
}

export function normalizeApplicantProfileInput(input: ApplicantProfileInput) {
  const parsed = profileInput.parse(input);
  return {
    ...parsed,
    preferredResumeId: parsed.preferredResumeId || null
  };
}

export function extensionProfileFromSources(input: {
  user?: { email?: string | null; name?: string | null } | null;
  profile?: any;
  resume?: { parsedJson?: unknown; totalExperienceYears?: number | null } | null;
  preferences?: { targetRole?: string | null; minimumSalary?: number | null } | null;
  noticePeriod?: string;
}) {
  const parsed = input.resume?.parsedJson as ParsedResume | undefined;
  const profile = input.profile;
  const fullName = profile?.fullName || parsed?.name || input.user?.name || "";
  const links = {
    linkedIn: profile?.linkedIn || "",
    portfolio: profile?.portfolio || "",
    github: profile?.github || ""
  };

  return {
    firstName: splitName(fullName).firstName,
    lastName: splitName(fullName).lastName,
    fullName,
    email: profile?.email || parsed?.email || input.user?.email || "",
    phone: profile?.phone || parsed?.phone || "",
    currentLocation: profile?.currentLocation || parsed?.location || "",
    targetRole: profile?.targetRole || input.preferences?.targetRole || "",
    totalExperience: parsed?.totalExperienceYears ?? input.resume?.totalExperienceYears ?? null,
    skills: parsed?.skills ?? [],
    expectedSalary: profile?.expectedSalary || input.preferences?.minimumSalary || "",
    availability: profile?.availability || "",
    noticePeriod: input.noticePeriod || profile?.availability || "",
    workAuthorization: profile?.workAuthorization || "",
    visaStatus: profile?.visaStatus || "",
    workHistory: profile?.workHistory ?? parsed?.workExperience ?? [],
    education: profile?.education ?? parsed?.education ?? [],
    certificates: profile?.certificates ?? [],
    customAnswers: profile?.customAnswers ?? [],
    coverLetter: "",
    ...links
  };
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.length > 1 ? parts.slice(1).join(" ") : "" };
}

function linesToItems(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}
