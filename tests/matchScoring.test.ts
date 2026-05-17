import test from "node:test";
import assert from "node:assert/strict";
import { calculateRuleBasedMatchScore } from "../src/lib/services/matchScoring";

test("calculates high match for aligned skills and experience", () => {
  const score = calculateRuleBasedMatchScore(
    {
      name: "Alex",
      email: "alex@example.com",
      phone: "",
      location: "Remote",
      skills: ["TypeScript", "Node.js", "PostgreSQL", "React"],
      workExperience: ["Built Node.js APIs for 4 years"],
      education: [],
      projects: [],
      totalExperienceYears: 4
    },
    {
      title: "Node.js Developer",
      company: "Acme",
      location: "Remote",
      remoteType: "REMOTE",
      salaryMin: 100000,
      salaryMax: 130000,
      experienceRequired: 3,
      description: "Node.js, TypeScript, PostgreSQL, REST, Docker"
    },
    {
      targetRole: "Node.js Developer",
      preferredLocations: ["Remote"],
      remotePreference: "REMOTE",
      minimumSalary: 90000,
      skillsToPrioritize: ["Node.js", "TypeScript"],
      skillsToAvoid: []
    }
  );

  assert.ok(score.overallScore >= 75);
  assert.equal(score.experienceScore, 100);
  assert.ok(score.missingSkills.includes("Docker"));
});
