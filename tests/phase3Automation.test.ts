import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAutomationRule } from "../src/lib/services/automationRules";
import { calculatePerformanceRows } from "../src/lib/services/analytics";
import { canFollowUpStatus } from "../src/lib/services/followUps";
import { evaluateDailyLimit } from "../src/lib/services/rateLimits";
import { evaluateAutomationRisk } from "../src/lib/services/risk";
import { classifySource, enforceSourceAutomationLevel, isAutomationAllowed } from "../src/lib/services/sourcePolicy";
import { parseRss } from "../src/lib/providers/rssJobProvider";

test("filters jobs through automation rules and safe source policy", () => {
  const result = evaluateAutomationRule(
    {
      name: "Backend",
      targetTitles: ["Backend"],
      locations: ["Remote"],
      remotePreference: "REMOTE",
      minMatchScore: 80,
      minSalary: 100000,
      requiredSkills: ["Node"],
      excludedCompanies: ["BadCo"],
      excludedKeywords: ["unpaid"],
      maxApplicationsPerDay: 10,
      approvalMode: "manual_review",
      enabled: true
    },
    {
      title: "Backend Engineer",
      company: "Acme",
      location: "Remote",
      remoteType: "REMOTE",
      salaryMin: 120000,
      description: "Node APIs and PostgreSQL",
      sourceType: "direct_email",
      automationLevel: "auto_send_email",
      matches: [{ overallScore: 91 }]
    }
  );
  assert.equal(result.matched, true);
});

test("blocks restricted platform automation above assisted apply", () => {
  const sourceType = classifySource({ source: "LinkedIn", applyUrl: "https://linkedin.com/jobs/view/1", description: "Apply here", title: "", company: "", location: "", remoteType: "FLEXIBLE" });
  const level = enforceSourceAutomationLevel({ sourceType, requestedLevel: "auto_send_email" });
  assert.equal(sourceType, "restricted_platform");
  assert.equal(level, "assisted_apply");
  assert.equal(isAutomationAllowed(level, "one_click_apply"), false);
});

test("allows direct email auto-send only after source approval", () => {
  const unapproved = enforceSourceAutomationLevel({ sourceType: "direct_email", requestedLevel: "auto_send_email" });
  const approved = enforceSourceAutomationLevel({ sourceType: "direct_email", requestedLevel: "auto_send_email", directEmailApproved: true });
  assert.equal(unapproved, "assisted_apply");
  assert.equal(approved, "auto_send_email");
});

test("allows one-click submit only for explicitly allowed company career pages", () => {
  const unapproved = enforceSourceAutomationLevel({ sourceType: "company_career_page", requestedLevel: "one_click_apply" });
  const approved = enforceSourceAutomationLevel({
    sourceType: "company_career_page",
    requestedLevel: "one_click_apply",
    companyDomainAllowed: true
  });

  assert.equal(unapproved, "assisted_apply");
  assert.equal(approved, "one_click_apply");
  assert.equal(isAutomationAllowed(unapproved, "one_click_apply"), false);
  assert.equal(isAutomationAllowed(approved, "one_click_apply"), true);
});

test("restricted job boards stay assisted-only even when submit is requested", () => {
  for (const applyUrl of [
    "https://www.linkedin.com/jobs/view/123",
    "https://www.indeed.com/viewjob?jk=123",
    "https://www.ziprecruiter.com/jobs/example"
  ]) {
    const sourceType = classifySource({ source: "Job board", applyUrl, description: "Apply on platform" });
    const level = enforceSourceAutomationLevel({ sourceType, requestedLevel: "one_click_apply", companyDomainAllowed: true });
    assert.equal(sourceType, "restricted_platform");
    assert.equal(level, "assisted_apply");
  }
});

test("evaluates generated application risk for unsafe sources", () => {
  const risk = evaluateAutomationRisk({ sourceType: "unknown", automationLevel: "save_only", description: "Visa sponsorship question" }, { body: "Hello" }, "unknown");
  assert.equal(risk.riskLevel, "high");
  assert.equal(risk.allowedAction, "manual_review");
  assert.ok(risk.warnings.length >= 2);
});

test("enforces daily limit math", () => {
  assert.deepEqual(evaluateDailyLimit(10, 10), { allowed: false, remaining: 0, limit: 10 });
  assert.deepEqual(evaluateDailyLimit(4, 10), { allowed: true, remaining: 6, limit: 10 });
});

test("detects allowed follow-up statuses", () => {
  assert.equal(canFollowUpStatus("APPLIED"), true);
  assert.equal(canFollowUpStatus("REJECTED"), false);
  assert.equal(canFollowUpStatus("APPLIED", true), false);
});

test("calculates analytics performance rows", () => {
  const rows = calculatePerformanceRows(
    [
      { source: "direct_email", status: "INTERVIEW" },
      { source: "direct_email", status: "APPLIED" },
      { source: "partner_feed", status: "APPLIED" }
    ],
    (item) => item.source,
    (item) => item.status !== "SAVED",
    (item) => item.status === "INTERVIEW"
  );
  assert.equal(rows.find((row) => row.label === "direct_email")?.interviewRate, 50);
});

test("normalizes RSS feed jobs into the shared schema", () => {
  const jobs = parseRss(`
    <rss><channel><item>
      <title>Backend Engineer at Acme</title>
      <link>https://acme.example/jobs/backend</link>
      <description><![CDATA[Remote Node.js role with 3 years experience.]]></description>
      <location>Remote</location>
    </item></channel></rss>
  `);
  assert.equal(jobs[0].sourceType, "partner_feed");
  assert.equal(jobs[0].remoteType, "REMOTE");
  assert.equal(jobs[0].experienceRequired, 3);
});
