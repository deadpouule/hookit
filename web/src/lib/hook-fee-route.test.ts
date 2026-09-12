import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_MASTER_WIZARD_STATE } from "./constants";
import { feeRouteSwapBps, hookPotBps } from "./hook-fee-route";

test("hook pot is hook tax plus optional creator cut", () => {
  const modules = {
    ...DEFAULT_MASTER_WIZARD_STATE.modules,
    creatorShareToHook: false,
    autoBurn: true,
    autoBurnPct: 40,
    holderAirdrop: true,
    holderAirdropPct: 60,
    backedFloor: false,
  };
  assert.equal(hookPotBps(modules, 500), 500);
  assert.equal(feeRouteSwapBps(modules, 500, "autoBurnPct"), 200);
  assert.equal(feeRouteSwapBps(modules, 500, "holderAirdropPct"), 300);

  const withCreator = { ...modules, creatorShareToHook: true };
  assert.equal(hookPotBps(withCreator, 500), 570);
  assert.equal(feeRouteSwapBps(withCreator, 500, "autoBurnPct"), 228);
});
