import test from "node:test";
import assert from "node:assert/strict";
import { extensionProfileFromSources, normalizeApplicantProfileInput } from "../src/lib/services/applicantProfile";

test("normalizes structured applicant profile sections", () => {
  const profile = normalizeApplicantProfileInput({
    fullName: " Priya Shah ",
    expectedSalary: 120000,
    preferredResumeId: "",
    workHistory: "Engineer at Acme\nLead at Beta",
    education: ["BS Computer Science"],
    certificates: "",
    customAnswers: "[\"Open to relocate\"]"
  });

  assert.equal(profile.fullName, "Priya Shah");
  assert.equal(profile.expectedSalary, "120000");
  assert.equal(profile.preferredResumeId, null);
  assert.deepEqual(profile.workHistory, ["Engineer at Acme", "Lead at Beta"]);
  assert.deepEqual(profile.customAnswers, ["Open to relocate"]);
});

test("extension profile prefers structured profile over resume fallbacks", () => {
  const profile = extensionProfileFromSources({
    user: { name: "Resume Name", email: "user@example.com" },
    profile: {
      fullName: "Priya Shah",
      email: "priya@example.com",
      phone: "555-0101",
      currentLocation: "Remote",
      targetRole: "Backend Engineer",
      expectedSalary: "150000",
      availability: "2 weeks",
      workAuthorization: "Authorized",
      linkedIn: "https://linkedin.com/in/priya",
      workHistory: ["Acme"],
      education: ["State University"],
      certificates: ["AWS"],
      customAnswers: ["Yes"]
    },
    resume: {
      parsedJson: {
        name: "Parsed Name",
        email: "parsed@example.com",
        phone: "000",
        location: "Old City",
        skills: ["Node"],
        workExperience: [],
        education: [],
        projects: [],
        totalExperienceYears: 5
      },
      totalExperienceYears: 5
    },
    preferences: { targetRole: "Frontend", minimumSalary: 100000 }
  });

  assert.equal(profile.fullName, "Priya Shah");
  assert.equal(profile.firstName, "Priya");
  assert.equal(profile.lastName, "Shah");
  assert.equal(profile.email, "priya@example.com");
  assert.equal(profile.expectedSalary, "150000");
  assert.deepEqual(profile.skills, ["Node"]);
  assert.deepEqual(profile.certificates, ["AWS"]);
});
