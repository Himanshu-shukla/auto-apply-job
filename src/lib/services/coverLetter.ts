import type { Job, JobPreference, Resume } from "@/generated/prisma/client";
import type { ParsedResume } from "@/lib/types";
import { generateAIResponse } from "@/lib/ai";

export async function generateCoverLetter(resume: Resume, job: Job, preferences?: JobPreference | null): Promise<string> {
  const parsedResume = resume.parsedJson as ParsedResume;
  const fallback = fallbackCoverLetter(parsedResume, job, preferences);
  const ai = await generateAIResponse<string>(
    "Write concise, truthful cover letters. Do not invent credentials. Keep the result between 150 and 250 words.",
    JSON.stringify({
      parsedResume,
      job: { title: job.title, company: job.company, description: job.description },
      preferences
    })
  );

  const content = typeof ai === "string" && ai.trim().split(/\s+/).length >= 120 ? ai.trim() : fallback;
  return trimToWordRange(content);
}

function fallbackCoverLetter(parsedResume: ParsedResume, job: Job, preferences?: JobPreference | null): string {
  const name = parsedResume.name || "I";
  const skills = parsedResume.skills.slice(0, 5).join(", ") || "relevant technical and collaboration skills";
  const target = preferences?.targetRole || job.title;

  return `Dear ${job.company} Hiring Team,

I am excited to apply for the ${job.title} role at ${job.company}. My background aligns closely with the work you described, especially the need for practical execution, clear communication, and reliable delivery in a ${target} capacity.

Across my projects and experience, I have worked with ${skills}, and I focus on turning requirements into maintainable outcomes that are easy for teams to extend. The role stands out because it combines hands-on problem solving with the kind of product and engineering judgment needed to support real users.

I would bring a thoughtful, review-first approach to this application. I have not added or assumed experience beyond what is reflected in my resume, but I would welcome the chance to discuss the parts of my background that best match your needs.

Thank you for your time and consideration.

Sincerely,
${name}`;
}

function trimToWordRange(content: string): string {
  const words = content.trim().split(/\s+/);
  if (words.length <= 250) return content.trim();
  return `${words.slice(0, 245).join(" ")}.`;
}
