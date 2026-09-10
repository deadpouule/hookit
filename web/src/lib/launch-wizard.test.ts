import assert from "node:assert/strict";
import test from "node:test";

import { creatorCutLock } from "./launch-wizard";

test("creatorCutLock blocks the rival hook, not the selected one", () => {
  assert.equal(creatorCutLock("buyback-vesting", { buybackVesting: true, creatorShareToHook: false }), null);
  assert.equal(
    creatorCutLock("creator-share-to-hook", { buybackVesting: false, creatorShareToHook: true }),
    null,
  );

  const vsCreator = creatorCutLock("buyback-vesting", {
    buybackVesting: false,
    creatorShareToHook: true,
  });
  assert.ok(vsCreator?.card.includes("Creator → Hook"));

  const vsBuyback = creatorCutLock("creator-share-to-hook", {
    buybackVesting: true,
    creatorShareToHook: false,
  });
  assert.ok(vsBuyback?.card.includes("Buyback Vesting"));
});
