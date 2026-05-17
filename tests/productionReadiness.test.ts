import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { normalizePreferences } from "../src/lib/services/preferences";
import { sanitizeRuleInput } from "../src/lib/services/automationRules";
import { generateApplicationAnswer } from "../src/lib/services/answerGeneration";
import { classifySource, enforceSourceAutomationLevel, isAutomationAllowed } from "../src/lib/services/sourcePolicy";
import { evaluateAutomationRisk } from "../src/lib/services/risk";

const root = process.cwd();

test("production web API routes must not use the shared demo user auth boundary", () => {
  const apiRoutes = listFiles(join(root, "src/app/api")).filter((file) => file.endsWith("route.ts"));
  const demoUserRoutes = apiRoutes
    .filter((file) => !file.includes("/api/extension/token/"))
    .filter((file) => readFileSync(file, "utf8").includes("getDemoUser"))
    .map((file) => file.replace(`${root}/`, ""));

  assert.deepEqual(
    demoUserRoutes,
    [],
    `Production routes are still bound to getDemoUser:\n${demoUserRoutes.join("\n")}`
  );
});

test("extension manifest must not request universal host access in production", () => {
  const manifest = JSON.parse(readFileSync(join(root, "extension/manifest.json"), "utf8"));
  assert.equal(
    manifest.host_permissions?.some((value: string) => value === "https://*/*" || value === "http://*/*"),
    false,
    "Extension requests universal http/https host permissions; use activeTab plus explicit allowlist/optional permissions."
  );
});

test("resume upload route must enforce a server-side file size limit before parsing", () => {
  const route = readFileSync(join(root, "src/app/api/resume/upload/route.ts"), "utf8");
  assert.match(route, /file\.size|MAX_(?:FILE|UPLOAD|RESUME)/, "No explicit resume upload size cap was found.");
});

test("malformed salary preferences should normalize to null instead of NaN", () => {
  const preferences = normalizePreferences({ targetRole: "Engineer", minimumSalary: "not-a-number" });
  assert.equal(preferences.minimumSalary, null);
});

test("automation rules clamp hostile daily application limits", () => {
  const rule = sanitizeRuleInput({
    name: "Mass apply",
    maxApplicationsPerDay: 1000,
    approvalMode: "allowed_source_auto_send_only",
    minMatchScore: -10
  });

  assert.equal(rule.maxApplicationsPerDay, 50);
  assert.equal(rule.minMatchScore, 0);
});

test("restricted and unknown sources cannot escalate beyond assisted apply/save-only", () => {
  const restrictedType = classifySource({
    source: "LinkedIn",
    applyUrl: "https://www.linkedin.com/jobs/view/123",
    description: "Apply on LinkedIn"
  });
  const restrictedLevel = enforceSourceAutomationLevel({ sourceType: restrictedType, requestedLevel: "auto_send_email" });
  const unknownLevel = enforceSourceAutomationLevel({ sourceType: "unknown", requestedLevel: "api_apply" });

  assert.equal(restrictedType, "restricted_platform");
  assert.equal(isAutomationAllowed(restrictedLevel, "one_click_apply"), false);
  assert.equal(unknownLevel, "save_only");
});

test("direct email auto-send must require explicit source approval", () => {
  const unapproved = enforceSourceAutomationLevel({ sourceType: "direct_email", requestedLevel: "auto_send_email" });
  const approved = enforceSourceAutomationLevel({
    sourceType: "direct_email",
    requestedLevel: "auto_send_email",
    directEmailApproved: true
  });

  assert.equal(unapproved, "assisted_apply");
  assert.equal(approved, "auto_send_email");
});

test("AI answers for sensitive questions require human confirmation", async () => {
  const answer = await generateApplicationAnswer(
    { question: "Will you now or in the future require visa sponsorship?", fieldLimit: 140 },
    null,
    null,
    []
  );

  assert.equal(answer.needsConfirmation, true);
  assert.match(answer.answer, /confirm/i);
  assert.ok(answer.answer.length <= 140);
});

test("automation risk marks sparse payloads and sensitive descriptions for review", () => {
  const risk = evaluateAutomationRisk(
    {
      sourceType: "direct_email",
      automationLevel: "auto_send_email",
      description: "Please include salary expectation and work authorization status."
    },
    { body: "" },
    "direct_email"
  );

  assert.equal(risk.riskLevel, "medium");
  assert.notEqual(risk.allowedAction, "auto_send_email");
  assert.ok(risk.warnings.some((warning) => /sensitive/i.test(warning)));
});

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}
