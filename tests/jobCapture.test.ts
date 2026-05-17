import test from "node:test";
import assert from "node:assert/strict";
import { inferSourcePlatform, normalizeCapturedJob } from "../src/lib/services/extensionJobs";

test("normalizes captured extension job details", () => {
  const job = normalizeCapturedJob({
    title: "Senior Node.js Engineer",
    company: "Acme",
    location: "Remote",
    description: "We need Node.js and PostgreSQL. 4+ years experience. USD 100000 to 140000.",
    applyUrl: "https://jobs.lever.co/acme/123"
  });
  assert.equal(job.sourcePlatform, "Lever");
  assert.equal(job.capturedFromExtension, true);
  assert.equal(job.remoteType, "REMOTE");
  assert.equal(job.experienceRequired, 4);
});

test("infers common source platforms", () => {
  assert.equal(inferSourcePlatform("https://boards.greenhouse.io/acme/jobs/1"), "Greenhouse");
  assert.equal(inferSourcePlatform("https://example.com/careers"), "example.com");
});
