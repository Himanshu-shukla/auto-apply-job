import test from "node:test";
import assert from "node:assert/strict";
import { generateExtensionToken, hashExtensionToken, maskToken } from "../src/lib/services/extensionAuth";

test("creates hash-only extension tokens with masked display", () => {
  const { plainToken, tokenHash } = generateExtensionToken();
  assert.match(plainToken, /^jacp_/);
  assert.equal(hashExtensionToken(plainToken), tokenHash);
  assert.notEqual(tokenHash, plainToken);
  assert.match(maskToken(plainToken), /^jacp_/);
});
