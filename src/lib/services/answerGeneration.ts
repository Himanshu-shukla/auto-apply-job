import type { Job, JobPreference, Resume } from "@/generated/prisma/client";
import { generateAIResponse } from "@/lib/ai";
import type { ParsedResume } from "@/lib/types";

type AnswerTemplate = {
  label: string;
  questionType: string;
  answer: string;
};

export type GenerateAnswerInput = {
  question: string;
  fieldLimit?: number | null;
  tone?: "professional" | "concise" | "confident";
  jobDescription?: string;
  jobTitle?: string;
  company?: string;
};

export type GeneratedApplicationAnswer = {
  answer: string;
  needsConfirmation: boolean;
  reason: string;
  questionType: string;
};

export async function generateApplicationAnswer(
  input: GenerateAnswerInput,
  resume: Resume | null,
  preferences: JobPreference | null,
  templates: AnswerTemplate[] = [],
  job?: Job | null
): Promise<GeneratedApplicationAnswer> {
  const parsedResume = resume?.parsedJson as ParsedResume | undefined;
  const questionType = classifyQuestion(input.question);
  const template = templates.find((item) => item.questionType === questionType);
  const fallback = fallbackAnswer(input, parsedResume, preferences, template, job);

  const ai = await generateAIResponse<GeneratedApplicationAnswer>(
    [
      "Generate truthful, short job application answers.",
      "Do not fabricate employers, tools, years of experience, degrees, authorization, salary, or relocation status.",
      "If the resume/preferences do not clearly answer the question, set needsConfirmation true and state what the user must confirm.",
      "Use a professional, concise, confident tone."
    ].join(" "),
    JSON.stringify({
      question: input.question,
      tone: input.tone ?? "professional",
      fieldLimit: input.fieldLimit ?? null,
      parsedResume,
      preferences,
      templates: templates.map(({ label, questionType, answer }) => ({ label, questionType, answer })),
      job: job
        ? { title: job.title, company: job.company, description: job.description }
        : { title: input.jobTitle, company: input.company, description: input.jobDescription }
    }),
    {
      answer: "string",
      needsConfirmation: "boolean",
      reason: "string",
      questionType: "string"
    }
  );

  const result = typeof ai === "object" && ai && "answer" in ai ? ai : fallback;
  if (isSensitiveConfirmationType(questionType) && fallback.needsConfirmation) {
    return enforceLength(fallback, input.fieldLimit);
  }
  return enforceLength({
    answer: sanitizeAnswer(result.answer || fallback.answer),
    needsConfirmation: Boolean(result.needsConfirmation || fallback.needsConfirmation),
    reason: result.reason || fallback.reason,
    questionType: result.questionType || questionType
  }, input.fieldLimit);
}

function isSensitiveConfirmationType(questionType: string): boolean {
  return ["work_authorization", "relocation", "notice_period"].includes(questionType);
}

export function classifyQuestion(question: string): string {
  const text = question.toLowerCase();
  if (/notice|available|start date/.test(text)) return "notice_period";
  if (/salary|compensation|ctc|pay/.test(text)) return "salary_expectation";
  if (/relocat/.test(text)) return "relocation";
  if (/authorization|authorized|visa|sponsor/.test(text)) return "work_authorization";
  if (/why.*hire|hire you|best candidate/.test(text)) return "why_hire_me";
  if (/why.*(role|company|interested)|interest/.test(text)) return "why_interested";
  if (/introduce|about yourself|summary/.test(text)) return "introduction";
  if (/experience|worked with|describe.*(node|react|python|java|sql|aws)/.test(text)) return "experience";
  return "custom";
}

function fallbackAnswer(
  input: GenerateAnswerInput,
  parsedResume?: ParsedResume,
  preferences?: JobPreference | null,
  template?: AnswerTemplate,
  job?: Job | null
): GeneratedApplicationAnswer {
  const questionType = classifyQuestion(input.question);
  if (template?.answer) {
    return { answer: template.answer, needsConfirmation: false, reason: "Used saved answer template.", questionType };
  }

  if (questionType === "notice_period") {
    return {
      answer: "My notice period is available for review and I can confirm the exact timeline before submission.",
      needsConfirmation: true,
      reason: "Notice period was not found in saved preferences.",
      questionType
    };
  }
  if (questionType === "salary_expectation") {
    const salary = preferences?.minimumSalary;
    return {
      answer: salary ? `My expected compensation is aligned around ${salary.toLocaleString()} or above, depending on the full role scope and benefits.` : "I am open to discussing compensation based on the role scope, benefits, and overall fit.",
      needsConfirmation: !salary,
      reason: salary ? "Used minimum salary preference." : "Salary preference is not saved.",
      questionType
    };
  }
  if (questionType === "relocation") {
    const locations = preferences?.preferredLocations ?? [];
    return {
      answer: locations.length ? `I am primarily targeting ${locations.join(", ")} and am open to discussing location expectations for the right fit.` : "I am open to discussing location expectations for the right fit.",
      needsConfirmation: true,
      reason: "Relocation willingness needs user confirmation.",
      questionType
    };
  }
  if (questionType === "work_authorization") {
    return {
      answer: "I can confirm my current work authorization status before submitting this application.",
      needsConfirmation: true,
      reason: "Work authorization is sensitive and must be confirmed by the user.",
      questionType
    };
  }

  const skills = parsedResume?.skills?.slice(0, 5).join(", ") || "the relevant skills in my resume";
  const title = job?.title || input.jobTitle || preferences?.targetRole || "this role";
  const company = job?.company || input.company || "your team";
  const experience = parsedResume?.totalExperienceYears ? `${parsedResume.totalExperienceYears} years of experience` : "hands-on project and work experience";

  const answer =
    questionType === "why_interested"
      ? `I am interested in ${title} at ${company} because it aligns with my background in ${skills} and gives me a chance to contribute to practical, user-focused outcomes.`
      : questionType === "why_hire_me"
        ? `You should consider me because I bring ${experience}, strength in ${skills}, and a careful execution style focused on reliable delivery.`
        : `My background includes ${experience} with ${skills}. I would connect those strengths to the needs of ${title} while staying honest about any areas I would need to ramp up on.`;

  return {
    answer,
    needsConfirmation: false,
    reason: "Generated from saved resume and preferences without adding unverified claims.",
    questionType
  };
}

function sanitizeAnswer(answer: string): string {
  return answer.replace(/\s+/g, " ").trim();
}

function enforceLength(answer: GeneratedApplicationAnswer, fieldLimit?: number | null): GeneratedApplicationAnswer {
  if (!fieldLimit || fieldLimit < 40 || answer.answer.length <= fieldLimit) return answer;
  return { ...answer, answer: `${answer.answer.slice(0, Math.max(0, fieldLimit - 1)).trim()}.` };
}
