import type { Job, JobPreference, Resume } from "@/generated/prisma/client";
import type { MatchScoreResult, ParsedResume } from "@/lib/types";
import { clampScore, extractSkillsFromText, includesTerm, unique } from "@/lib/services/text";

type ScoreJob = Pick<
  Job,
  "title" | "company" | "location" | "remoteType" | "salaryMin" | "salaryMax" | "experienceRequired" | "description"
>;

type ScorePreference = Pick<
  JobPreference,
  "targetRole" | "preferredLocations" | "remotePreference" | "minimumSalary" | "skillsToPrioritize" | "skillsToAvoid"
>;

export function calculateRuleBasedMatchScore(
  parsedResume: ParsedResume,
  job: ScoreJob,
  preferences?: ScorePreference | null,
  aiExplanation?: string
): MatchScoreResult {
  const resumeText = `${parsedResume.skills.join(" ")} ${parsedResume.workExperience.join(" ")} ${parsedResume.projects.join(" ")}`;
  const preferredSkills = preferences?.skillsToPrioritize ?? [];
  const jobSkills = extractSkillsFromText(job.description, preferredSkills);
  const resumeSkills = parsedResume.skills;
  const matchingSkills = jobSkills.filter((skill) => resumeSkills.some((resumeSkill) => sameSkill(skill, resumeSkill)));
  const missingSkills = jobSkills.filter((skill) => !matchingSkills.some((matched) => sameSkill(skill, matched)));
  const avoidedHits = (preferences?.skillsToAvoid ?? []).filter((skill) => includesTerm(job.description, skill));

  const skillsScore = jobSkills.length ? (matchingSkills.length / jobSkills.length) * 100 : 70;
  const experienceRequired = job.experienceRequired ?? 0;
  const experienceDelta = parsedResume.totalExperienceYears - experienceRequired;
  const experienceScore =
    experienceRequired <= 0 ? 80 : experienceDelta >= 0 ? 100 : experienceDelta >= -1 ? 75 : experienceDelta >= -2 ? 55 : 30;

  const roleScore = preferences?.targetRole
    ? roleSimilarity(preferences.targetRole, job.title)
    : includesTerm(resumeText, job.title)
      ? 85
      : 65;

  const locationScore = locationMatch(job, preferences);
  const salaryScore = salaryMatch(job, preferences);

  const overallScore = clampScore(
    skillsScore * 0.35 + experienceScore * 0.2 + roleScore * 0.2 + locationScore * 0.15 + salaryScore * 0.1 - avoidedHits.length * 8
  );

  const strongMatchingPoints = unique([
    ...matchingSkills.slice(0, 6).map((skill) => `${skill} appears in both resume and job description`),
    experienceDelta >= 0 && experienceRequired > 0 ? `Experience meets the ${experienceRequired}+ year requirement` : "",
    locationScore >= 90 ? "Location or remote preference aligns well" : ""
  ]);

  const riskFactors = unique([
    ...missingSkills.slice(0, 6).map((skill) => `Missing or unclear ${skill} evidence`),
    experienceDelta < 0 && experienceRequired > 0 ? `Resume shows ${parsedResume.totalExperienceYears} years vs ${experienceRequired} requested` : "",
    locationScore < 60 ? "Location or remote preference may not align" : "",
    salaryScore < 60 ? "Salary may be below stated minimum" : "",
    ...avoidedHits.map((skill) => `Job mentions avoided skill or focus area: ${skill}`)
  ]);

  return {
    overallScore,
    skillsScore: clampScore(skillsScore),
    experienceScore: clampScore(experienceScore),
    roleScore: clampScore(roleScore),
    locationScore: clampScore(locationScore),
    salaryScore: clampScore(salaryScore),
    missingSkills: unique(missingSkills).slice(0, 10),
    strongMatchingPoints,
    riskFactors,
    aiExplanation:
      aiExplanation ||
      `Rule-based score: ${overallScore}/100. The strongest signals are ${matchingSkills.slice(0, 4).join(", ") || "general profile fit"}. Review risk factors before applying.`
  };
}

export function parsedResumeFromRecord(resume: Resume): ParsedResume {
  return resume.parsedJson as ParsedResume;
}

function sameSkill(left: string, right: string): boolean {
  return left.toLowerCase().replace(/\W/g, "") === right.toLowerCase().replace(/\W/g, "");
}

function roleSimilarity(targetRole: string, title: string): number {
  const targetWords = targetRole.toLowerCase().split(/\W+/).filter(Boolean);
  const titleWords = title.toLowerCase().split(/\W+/).filter(Boolean);
  const overlap = targetWords.filter((word) => titleWords.includes(word));
  if (title.toLowerCase().includes(targetRole.toLowerCase())) return 100;
  if (overlap.length === 0) return 45;
  return clampScore(55 + (overlap.length / Math.max(targetWords.length, 1)) * 45);
}

function locationMatch(job: ScoreJob, preferences?: ScorePreference | null): number {
  if (!preferences) return 75;
  if (preferences.remotePreference === "FLEXIBLE") return 85;
  if (preferences.remotePreference === job.remoteType) return 100;
  if (preferences.remotePreference === "REMOTE" && job.remoteType === "FLEXIBLE") return 90;

  const locations = preferences.preferredLocations ?? [];
  if (locations.some((location) => includesTerm(job.location, location))) return 90;
  if (job.remoteType === "REMOTE") return 80;
  return 45;
}

function salaryMatch(job: ScoreJob, preferences?: ScorePreference | null): number {
  if (!preferences?.minimumSalary) return 80;
  if (!job.salaryMin && !job.salaryMax) return 65;
  const upper = job.salaryMax ?? job.salaryMin ?? 0;
  const lower = job.salaryMin ?? upper;
  if (upper >= preferences.minimumSalary) return lower >= preferences.minimumSalary ? 100 : 80;
  return 40;
}
