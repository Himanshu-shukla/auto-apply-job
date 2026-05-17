import type { Job, Resume } from "@/generated/prisma/client";
import type { ParsedResume, ResumeSuggestionResult } from "@/lib/types";
import { generateAIResponse } from "@/lib/ai";
import { extractSkillsFromText, unique } from "@/lib/services/text";

export async function buildResumeSuggestions(resume: Resume, job: Job): Promise<ResumeSuggestionResult> {
  const parsedResume = resume.parsedJson as ParsedResume;
  const jobSkills = extractSkillsFromText(job.description);
  const missingSkills = jobSkills.filter(
    (skill) => !parsedResume.skills.some((resumeSkill) => resumeSkill.toLowerCase() === skill.toLowerCase())
  );

  const fallback = fallbackSuggestions(parsedResume, job, missingSkills);
  const ai = await generateAIResponse<ResumeSuggestionResult>(
    "You are a truthful resume coach. Never invent experience. Label every suggestion by confidence and require user confirmation for unverified claims.",
    JSON.stringify({ parsedResume, job: { title: job.title, company: job.company, description: job.description }, fallback }),
    {
      safeToAddIfTrue: ["string"],
      needsUserConfirmation: ["string"],
      missingSkillToLearn: ["string"],
      keywords: ["string"],
      improvedBullets: ["string"],
      weakAreas: ["string"]
    }
  );

  return ai && typeof ai === "object" ? sanitizeSuggestions(ai as ResumeSuggestionResult, fallback) : fallback;
}

function fallbackSuggestions(parsedResume: ParsedResume, job: Job, missingSkills: string[]): ResumeSuggestionResult {
  const keywords = unique([...extractSkillsFromText(job.description), job.title, job.company]).slice(0, 12);
  const visibleSkills = parsedResume.skills.slice(0, 4).join(", ") || "your strongest relevant skills";

  return {
    safeToAddIfTrue: [
      `Mirror role language such as "${job.title}" in the summary if it accurately reflects your target.`,
      `Highlight measurable outcomes from projects using ${visibleSkills}.`,
      "Move the most relevant skills for this job into the top third of the resume."
    ],
    needsUserConfirmation: [
      `Add a bullet about ${job.company}'s domain only if you have comparable domain experience.`,
      "Confirm whether any listed projects involved production users, revenue impact, reliability work, or cross-functional collaboration."
    ],
    missingSkillToLearn: missingSkills.slice(0, 6),
    keywords,
    improvedBullets: [
      `Built and improved software workflows using ${visibleSkills}, with clear ownership from implementation through release.`,
      "Partnered with stakeholders to translate requirements into maintainable, tested deliverables."
    ],
    weakAreas: missingSkills.length
      ? [`The resume does not clearly show ${missingSkills.slice(0, 4).join(", ")}.`]
      : ["The resume appears broadly aligned; strengthen bullets with metrics and job-specific keywords."]
  };
}

function sanitizeSuggestions(ai: ResumeSuggestionResult, fallback: ResumeSuggestionResult): ResumeSuggestionResult {
  return {
    safeToAddIfTrue: ai.safeToAddIfTrue?.length ? ai.safeToAddIfTrue : fallback.safeToAddIfTrue,
    needsUserConfirmation: ai.needsUserConfirmation?.length ? ai.needsUserConfirmation : fallback.needsUserConfirmation,
    missingSkillToLearn: ai.missingSkillToLearn ?? fallback.missingSkillToLearn,
    keywords: ai.keywords?.length ? ai.keywords : fallback.keywords,
    improvedBullets: ai.improvedBullets?.length ? ai.improvedBullets : fallback.improvedBullets,
    weakAreas: ai.weakAreas?.length ? ai.weakAreas : fallback.weakAreas
  };
}
