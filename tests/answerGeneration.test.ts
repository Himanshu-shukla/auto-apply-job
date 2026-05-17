import test from "node:test";
import assert from "node:assert/strict";
import { classifyQuestion, generateApplicationAnswer } from "../src/lib/services/answerGeneration";

test("classifies common custom application questions", () => {
  assert.equal(classifyQuestion("What salary do you expect?"), "salary_expectation");
  assert.equal(classifyQuestion("Do you need visa sponsorship?"), "work_authorization");
  assert.equal(classifyQuestion("Why should we hire you?"), "why_hire_me");
});

test("marks sensitive work authorization answers for confirmation", async () => {
  const answer = await generateApplicationAnswer(
    { question: "Do you have work authorization?", tone: "concise" },
    null,
    null,
    []
  );
  assert.equal(answer.needsConfirmation, true);
  assert.match(answer.answer, /confirm/i);
});
