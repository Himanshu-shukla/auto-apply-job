import type { ParsedResume } from "@/lib/types";
import { extractSkillsFromText, unique } from "@/lib/services/text";

export async function extractResumeText(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  const lowerName = fileName.toLowerCase();
  if (mimeType.includes("pdf") || lowerName.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    return normalizeText(parsed.text);
  }

  if (
    mimeType.includes("wordprocessingml") ||
    mimeType.includes("msword") ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc")
  ) {
    const mammoth = await import("mammoth");
    const parsed = await mammoth.extractRawText({ buffer });
    return normalizeText(parsed.value);
  }

  throw new Error("Unsupported resume file type. Please upload a PDF or DOCX file.");
}

export function parseResumeText(rawText: string): ParsedResume {
  const text = normalizeText(rawText);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() ?? "";
  const name = inferName(lines, email);
  const location = inferLocation(lines);
  const skills = extractSkillsFromText(text);

  const workExperience = extractSection(lines, ["experience", "employment", "work history"], [
    "education",
    "projects",
    "skills",
    "certifications"
  ]);
  const education = extractSection(lines, ["education"], ["experience", "projects", "skills", "certifications"]);
  const projects = extractSection(lines, ["projects"], ["experience", "education", "skills", "certifications"]);

  return {
    name,
    email,
    phone,
    location,
    skills,
    workExperience,
    education,
    projects,
    totalExperienceYears: inferExperienceYears(text, workExperience)
  };
}

function normalizeText(value: string): string {
  return value.replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();
}

function inferName(lines: string[], email: string): string {
  const emailUser = email.split("@")[0]?.replace(/[._-]/g, " ").trim().toLowerCase();
  const candidate = lines.find((line) => {
    const lower = line.toLowerCase();
    return (
      line.length <= 70 &&
      !lower.includes("@") &&
      !/\d{4,}/.test(line) &&
      !["resume", "curriculum vitae", "cv"].includes(lower)
    );
  });

  if (candidate) return candidate;
  return emailUser ? emailUser.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";
}

function inferLocation(lines: string[]): string {
  const labeled = lines.find((line) => /location|address|based in/i.test(line));
  if (labeled) return labeled.replace(/^(location|address|based in)\s*:?\s*/i, "").trim();

  const cityState = lines.find((line) => /^[A-Za-z .-]+,\s*[A-Za-z .-]+$/.test(line) && line.length < 60);
  return cityState ?? "";
}

function extractSection(lines: string[], starts: string[], stops: string[]): string[] {
  const startIndex = lines.findIndex((line) => starts.some((start) => line.toLowerCase().includes(start)));
  if (startIndex < 0) return [];

  const items: string[] = [];
  for (const line of lines.slice(startIndex + 1)) {
    const lower = line.toLowerCase();
    if (stops.some((stop) => lower === stop || lower.startsWith(`${stop}:`))) break;
    if (line.length > 2) items.push(line.replace(/^[-*•]\s*/, ""));
    if (items.length >= 12) break;
  }
  return unique(items);
}

function inferExperienceYears(text: string, workExperience: string[]): number {
  const explicit = text.match(/(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)\s+(?:of\s+)?experience/i);
  if (explicit) return Number(explicit[1]);

  const years = Array.from(text.matchAll(/\b(20\d{2}|19\d{2})\b/g)).map((match) => Number(match[1]));
  if (years.length >= 2) {
    const min = Math.min(...years);
    const max = Math.max(...years, new Date().getFullYear());
    return Math.max(0, Math.min(40, max - min));
  }

  return workExperience.length >= 4 ? 3 : workExperience.length >= 2 ? 1 : 0;
}
