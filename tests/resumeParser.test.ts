import test from "node:test";
import assert from "node:assert/strict";
import { parseResumeText } from "../src/lib/services/resumeParser";

test("parses core resume fields from text", () => {
  const parsed = parseResumeText(`
    Priya Shah
    priya@example.com
    +1 555 123 4567
    Location: Remote
    Skills
    TypeScript, Node.js, PostgreSQL, React
    Experience
    Software Engineer 2020 - 2026
    Education
    B.Tech Computer Science
  `);

  assert.equal(parsed.name, "Priya Shah");
  assert.equal(parsed.email, "priya@example.com");
  assert.ok(parsed.phone.includes("555"));
  assert.ok(parsed.skills.includes("TypeScript"));
  assert.ok(parsed.totalExperienceYears >= 6);
});
