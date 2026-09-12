import assert from "node:assert/strict";
import test from "node:test";

import { EXPLORE_HOOKS, MASTER_HOOKS } from "./master-hooks";

test("hooks page order: airdrop / deepen / burn swapped to the front slots", () => {
  assert.deepEqual(
    EXPLORE_HOOKS.map((hook) => hook.id),
    [
      "holder-airdrop",
      "backed-floor",
      "buyback-vesting",
      "dynamic-fees",
      "fixed-fee",
      "deepen-lps",
      "auto-burn",
      "anti-mev",
      "max-wallet",
      "max-tx",
      "anti-snipe",
      "creator-share-to-hook",
    ],
  );
  assert.deepEqual(
    MASTER_HOOKS.map((hook) => hook.id),
    [
      "holder-airdrop",
      "backed-floor",
      "buyback-vesting",
      "dynamic-fees",
      "deepen-lps",
      "auto-burn",
      "anti-mev",
      "max-wallet",
      "max-tx",
      "anti-snipe",
      "creator-share-to-hook",
    ],
  );
});
