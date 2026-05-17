import test from "node:test";
import assert from "node:assert/strict";
import { normalizePreferences } from "../src/lib/services/preferences";

test("normalizes preference payload for saving", () => {
  const preferences = normalizePreferences({
    targetRole: " Backend Developer ",
    preferredLocations: "Remote, Austin",
    remotePreference: "REMOTE",
    minimumSalary: "120000",
    experienceLevel: "SENIOR",
    jobType: "FULL_TIME",
    skillsToPrioritize: "Node.js, PostgreSQL",
    skillsToAvoid: "Travel",
    sourcePreferences: "MockJobs, ManualImport"
  });

  assert.equal(preferences.targetRole, "Backend Developer");
  assert.deepEqual(preferences.preferredLocations, ["Remote", "Austin"]);
  assert.equal(preferences.minimumSalary, 120000);
  assert.deepEqual(preferences.skillsToPrioritize, ["Node.js", "PostgreSQL"]);
});
