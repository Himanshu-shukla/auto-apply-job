import test from "node:test";
import assert from "node:assert/strict";
import { inferSourcePlatform, normalizeBulkCapturedJobs, normalizeCapturedJob } from "../src/lib/services/extensionJobs";
import { classifySource } from "../src/lib/services/sourcePolicy";

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
  assert.equal(inferSourcePlatform("https://www.ziprecruiter.com/jobs/acme"), "ZipRecruiter");
  assert.equal(inferSourcePlatform("https://www.dice.com/job-detail/1"), "Dice");
});

test("classifies supported job boards as restricted platforms", () => {
  const boards = [
    ["LinkedIn", "https://www.linkedin.com/jobs/view/1"],
    ["Indeed", "https://www.indeed.com/viewjob?jk=1"],
    ["ZipRecruiter", "https://www.ziprecruiter.com/jobs/acme-1"],
    ["Glassdoor", "https://www.glassdoor.com/job-listing/1.htm"],
    ["Dice", "https://www.dice.com/job-detail/1"]
  ];
  for (const [source, applyUrl] of boards) {
    assert.equal(classifySource({ source, applyUrl, description: "Software engineer role" }), "restricted_platform");
  }
});

test("normalizes and dedupes browser-captured search results", () => {
  const jobs = normalizeBulkCapturedJobs({
    sourcePlatform: "LinkedIn",
    pageUrl: "https://www.linkedin.com/jobs/search",
    jobs: [
      { title: "Engineer", company: "Acme", applyUrl: "/jobs/view/1", snippet: "Build services." },
      { title: "Engineer", company: "Acme", applyUrl: "/jobs/view/1", snippet: "Duplicate." },
      { title: "Analyst", company: "Beta", applyUrl: "https://www.linkedin.com/jobs/view/2", description: "Analyze data." }
    ]
  });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].sourcePlatform, "LinkedIn");
  assert.equal(jobs[0].applyUrl, "https://www.linkedin.com/jobs/view/1");
  assert.equal(jobs[0].description, "Build services.");
});
