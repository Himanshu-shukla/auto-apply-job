import test from "node:test";
import assert from "node:assert/strict";
import { mapDetectedField } from "../src/lib/services/fieldMapping";

test("maps common application fields with rule-based confidence", () => {
  const email = mapDetectedField({ label: "Email Address", type: "email" });
  assert.equal(email.profileKey, "email");
  assert.ok(email.confidence >= 95);

  const salary = mapDetectedField({ label: "Expected CTC", placeholder: "Salary expectation" });
  assert.equal(salary.profileKey, "expectedSalary");

  const question = mapDetectedField({ label: "Why should we hire you?", tagName: "textarea" });
  assert.equal(question.profileKey, "customQuestion");
  assert.equal(question.needsAiFallback, true);
});
