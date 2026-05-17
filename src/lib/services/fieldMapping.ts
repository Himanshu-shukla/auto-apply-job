export type DetectedField = {
  id?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  nearbyText?: string;
  type?: string;
  tagName?: string;
  options?: string[];
};

export type ProfileKey =
  | "fullName"
  | "email"
  | "phone"
  | "currentLocation"
  | "targetRole"
  | "totalExperience"
  | "skills"
  | "expectedSalary"
  | "noticePeriod"
  | "linkedIn"
  | "portfolio"
  | "github"
  | "coverLetter"
  | "resumeUpload"
  | "workAuthorization";

export type FieldMapping = {
  field: DetectedField;
  profileKey: ProfileKey | "customQuestion" | "unknown";
  confidence: number;
  reason: string;
  needsAiFallback: boolean;
};

const rules: Array<{ key: ProfileKey; weight: number; patterns: RegExp[] }> = [
  { key: "fullName", weight: 98, patterns: [/\b(full\s*)?name\b/i, /\bcandidate\s+name\b/i, /\bfirst.*last\b/i] },
  { key: "email", weight: 99, patterns: [/\be-?mail\b/i, /\bemail\s+address\b/i] },
  { key: "phone", weight: 96, patterns: [/\bphone\b/i, /\bmobile\b/i, /\bcontact\s+number\b/i] },
  { key: "currentLocation", weight: 88, patterns: [/\blocation\b/i, /\bcity\b/i, /\baddress\b/i, /\bcurrent\s+location\b/i] },
  { key: "linkedIn", weight: 96, patterns: [/\blinkedin\b/i, /\blinked\s*in\b/i] },
  { key: "portfolio", weight: 92, patterns: [/\bportfolio\b/i, /\bwebsite\b/i, /\bpersonal\s+site\b/i] },
  { key: "github", weight: 96, patterns: [/\bgithub\b/i, /\bgit\s*hub\b/i] },
  { key: "expectedSalary", weight: 92, patterns: [/\bexpected\s+(salary|ctc|compensation)\b/i, /\bsalary\s+expect/i, /\bdesired\s+salary\b/i] },
  { key: "noticePeriod", weight: 92, patterns: [/\bnotice\s+period\b/i, /\bavailable\s+to\s+start\b/i, /\bstart\s+date\b/i] },
  { key: "workAuthorization", weight: 91, patterns: [/\bwork\s+authorization\b/i, /\bauthorized\s+to\s+work\b/i, /\bvisa\b/i, /\bsponsorship\b/i] },
  { key: "totalExperience", weight: 88, patterns: [/\byears?\s+of\s+experience\b/i, /\btotal\s+experience\b/i, /\bexperience\b/i] },
  { key: "skills", weight: 84, patterns: [/\bskills?\b/i, /\btechnolog(y|ies)\b/i, /\btools\b/i] },
  { key: "targetRole", weight: 78, patterns: [/\bdesired\s+role\b/i, /\bcurrent\s+title\b/i, /\bjob\s+title\b/i] },
  { key: "coverLetter", weight: 90, patterns: [/\bcover\s+letter\b/i, /\bmessage\s+to\s+hiring\b/i, /\badditional\s+information\b/i] },
  { key: "resumeUpload", weight: 99, patterns: [/\bresume\b/i, /\bcv\b/i, /\bupload\b/i] }
];

export function mapDetectedField(field: DetectedField): FieldMapping {
  const searchable = [
    field.label,
    field.placeholder,
    field.name,
    field.id,
    field.nearbyText,
    field.type,
    field.options?.join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/[_-]+/g, " ");

  if (field.type === "file" || /\b(file|upload)\b/i.test(searchable)) {
    return { field, profileKey: "resumeUpload", confidence: 99, reason: "File input or upload label detected.", needsAiFallback: false };
  }

  let best: { key: ProfileKey; confidence: number; reason: string } | null = null;
  for (const rule of rules) {
    const matched = rule.patterns.find((pattern) => pattern.test(searchable));
    if (matched && (!best || rule.weight > best.confidence)) {
      best = { key: rule.key, confidence: rule.weight, reason: `Matched ${matched.source.replace(/\\b|\\s\*|\(\?:|\)/g, "")}.` };
    }
  }

  if (field.type === "email") {
    best = { key: "email", confidence: 99, reason: "Input type is email." };
  } else if (field.type === "tel") {
    best = { key: "phone", confidence: 98, reason: "Input type is telephone." };
  } else if (field.type === "url" && /github/i.test(searchable)) {
    best = { key: "github", confidence: 96, reason: "URL field mentions GitHub." };
  } else if (field.type === "url" && /linkedin/i.test(searchable)) {
    best = { key: "linkedIn", confidence: 96, reason: "URL field mentions LinkedIn." };
  } else if (field.type === "url" && !best) {
    best = { key: "portfolio", confidence: 74, reason: "Generic URL field mapped to portfolio with review recommended." };
  }

  if (best) {
    return { field, profileKey: best.key, confidence: best.confidence, reason: best.reason, needsAiFallback: best.confidence < 80 };
  }

  const isLongText = field.tagName?.toLowerCase() === "textarea" || /why|describe|tell us|explain|interest|hire/i.test(searchable);
  return {
    field,
    profileKey: isLongText ? "customQuestion" : "unknown",
    confidence: isLongText ? 58 : 20,
    reason: isLongText ? "Looks like an open-ended application question." : "No confident rule-based match.",
    needsAiFallback: true
  };
}

export function mapDetectedFields(fields: DetectedField[]): FieldMapping[] {
  return fields.map(mapDetectedField);
}
