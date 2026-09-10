import assert from "node:assert/strict";
import test from "node:test";

import { EXPLORE_HOOKS, MASTER_HOOKS } from "./master-hooks";

test("hooks page order: vest↔mev, max-tx↔dynamic, fixed↔max-wallet", () => {
  assert.deepEqual(
    EXPLORE_HOOKS.map((hook) => hook.id),
    [
      "anti-snipe",
      "backed-floor",
      "buyback-vesting",
      "dynamic-fees",
      "fixed-fee",
      "max-tx",
      "max-wallet",
      "anti-mev",
      "auto-burn",
      "deepen-lps",
      "holder-airdrop",
      "creator-share-to-hook",
    ],
  );
  assert.deepEqual(
    MASTER_HOOKS.map((hook) => hook.id),
    [
      "anti-snipe",
      "backed-floor",
      "buyback-vesting",
      "dynamic-fees",
      "max-tx",
      "max-wallet",
      "anti-mev",
      "auto-burn",
      "deepen-lps",
      "holder-airdrop",
      "creator-share-to-hook",
    ],
  );
});
