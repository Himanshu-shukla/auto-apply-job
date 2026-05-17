import test from "node:test";
import assert from "node:assert/strict";
import { nextApplicationHistory } from "../src/lib/services/application";

test("records application status updates in history", () => {
  const history = nextApplicationHistory({ history: [], status: "SAVED" } as any, "APPLIED", "Submitted manually");
  assert.equal(history.length, 1);
  assert.equal(history[0].from, "SAVED");
  assert.equal(history[0].to, "APPLIED");
  assert.equal(history[0].note, "Submitted manually");
});
