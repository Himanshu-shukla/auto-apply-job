export const KNOWN_SKILLS = [
  "javascript",
  "typescript",
  "node.js",
  "node",
  "react",
  "next.js",
  "postgresql",
  "postgres",
  "prisma",
  "sql",
  "python",
  "java",
  "aws",
  "docker",
  "kubernetes",
  "ci/cd",
  "graphql",
  "rest",
  "tailwind",
  "html",
  "css",
  "git",
  "analytics",
  "excel",
  "tableau",
  "power bi",
  "machine learning",
  "llm",
  "openai",
  "testing",
  "jest",
  "playwright",
  "devops",
  "linux",
  "support",
  "qa",
  "etl",
  "redis",
  "mongodb"
];

export function splitList(value: string | string[] | undefined | null): string[] {
  if (Array.isArray(value)) return value.map(cleanToken).filter(Boolean);
  if (!value) return [];
  return value
    .split(/[,;\n]/)
    .map(cleanToken)
    .filter(Boolean);
}

export function cleanToken(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(cleanToken).filter(Boolean)));
}

export function includesTerm(text: string, term: string): boolean {
  const normalizedText = text.toLowerCase();
  const normalizedTerm = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9+#.])${normalizedTerm}([^a-z0-9+#.]|$)`, "i").test(normalizedText);
}

export function extractSkillsFromText(text: string, extraSkills: string[] = []): string[] {
  const allSkills = unique([...KNOWN_SKILLS, ...extraSkills]);
  return allSkills
    .filter((skill) => includesTerm(text, skill))
    .map((skill) => (skill === "node" ? "Node.js" : skill === "postgres" ? "PostgreSQL" : titleSkill(skill)));
}

function titleSkill(skill: string): string {
  const fixed: Record<string, string> = {
    "typescript": "TypeScript",
    "javascript": "JavaScript",
    "next.js": "Next.js",
    "node.js": "Node.js",
    "ci/cd": "CI/CD",
    "llm": "LLM",
    "openai": "OpenAI",
    "aws": "AWS",
    "qa": "QA",
    "etl": "ETL",
    "sql": "SQL",
    "html": "HTML",
    "css": "CSS"
  };
  return fixed[skill] ?? skill.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
