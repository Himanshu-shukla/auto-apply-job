import test from "node:test";
import assert from "node:assert/strict";
import { AshbyProvider } from "../src/lib/providers/ashbyProvider";
import { GreenhouseProvider } from "../src/lib/providers/greenhouseProvider";
import { LeverProvider } from "../src/lib/providers/leverProvider";
import { RestrictedPlatformProvider } from "../src/lib/providers/restrictedPlatformProviders";
import { evaluateCampaignQueueDecision } from "../src/lib/services/campaigns";

test("restricted platform providers remain assisted-only without official access", () => {
  const provider = new RestrictedPlatformProvider("LinkedIn");
  const job = provider.normalizeJob({
    title: "Engineer",
    company: "Acme",
    location: "Remote",
    remoteType: "REMOTE",
    description: "Build products.",
    applyUrl: "https://linkedin.com/jobs/view/1",
    source: "LinkedIn"
  });
  assert.equal(provider.capabilities.canSubmit, false);
  assert.equal(job.sourceType, "restricted_platform");
  assert.equal(job.automationLevel, "assisted_apply");
});

test("official ATS providers expose search capabilities and credential-gated submit", () => {
  const providers = [new GreenhouseProvider(), new LeverProvider(), new AshbyProvider()];
  assert.equal(providers.every((provider) => provider.capabilities.canSearch), true);
  assert.equal(providers.every((provider) => provider.capabilities.canAssistedApply), true);
  assert.equal(new AshbyProvider().capabilities.canSubmit, false);
  assert.equal(new GreenhouseProvider().capabilities.requiresCredential, true);
  assert.equal(new LeverProvider().capabilities.requiresCredential, true);
});

test("campaign queue decisions block save-only and low-score jobs", () => {
  assert.deepEqual(
    evaluateCampaignQueueDecision({ sourceType: "company_career_page", automationLevel: "one_click_apply", matchScore: 88, minMatchScore: 70 }),
    { queue: true, status: "needs_review", recommendedAction: "extension_assisted_apply" }
  );
  assert.deepEqual(
    evaluateCampaignQueueDecision({ sourceType: "unknown", automationLevel: "save_only", matchScore: 88, minMatchScore: 70 }),
    { queue: true, status: "blocked", recommendedAction: "save_only" }
  );
  assert.deepEqual(
    evaluateCampaignQueueDecision({ sourceType: "direct_email", automationLevel: "auto_send_email", matchScore: 60, minMatchScore: 70 }),
    { queue: false, status: "blocked", recommendedAction: "below_match_threshold" }
  );
});
