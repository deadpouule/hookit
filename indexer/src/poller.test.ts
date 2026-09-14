import assert from "node:assert/strict";
import test from "node:test";

import { isHookInternalSwap } from "./poller.js";

const HOOK = "0xa506Ed2D09a164E5d12993B34F4Eb1D01ad46ac8" as const;
const ROUTER = "0x6889635F39c472802AbdE7Db791f2Ea48090091A" as const;

test("isHookInternalSwap flags swaps the pool hook performs on itself, case-insensitively", () => {
  assert.equal(isHookInternalSwap({ hooks: HOOK }, HOOK), true);
  assert.equal(isHookInternalSwap({ hooks: HOOK }, HOOK.toLowerCase() as typeof HOOK), true);
  assert.equal(isHookInternalSwap({ hooks: HOOK }, ROUTER), false);
});

test("isHookInternalSwap keeps every swap when the row has no hook recorded yet", () => {
  assert.equal(isHookInternalSwap({}, HOOK), false);
  assert.equal(isHookInternalSwap({ hooks: undefined }, ROUTER), false);
});
