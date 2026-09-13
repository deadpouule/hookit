import assert from "node:assert/strict";
import test from "node:test";

import { firstEnabledPairing, isPairingDisabled, PAIRING_TOKENS } from "./pairing-tokens";

test("Netflix pairing is greyed out until Quotrons patches the pool", () => {
  const nflx = PAIRING_TOKENS.find((token) => token.id === "wnflxx");
  assert.equal(nflx?.disabled, true);
  assert.equal(isPairingDisabled("wnflxx"), true);
  assert.equal(isPairingDisabled("eth"), false);
  assert.equal(isPairingDisabled("wnvdax"), false);
});

test("multi-pair does not auto-pick a disabled Netflix quote", () => {
  const second = firstEnabledPairing("eth");
  assert.ok(second);
  assert.equal(second.disabled, undefined);
  assert.notEqual(second.id, "wnflxx");
});
