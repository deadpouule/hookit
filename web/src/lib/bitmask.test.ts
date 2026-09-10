import assert from "node:assert/strict";
import test from "node:test";

import { packLaunchBitmask, unpackLaunchBitmask } from "./bitmask";
import type { LaunchModules } from "./types";

function modules(over: Partial<LaunchModules> = {}): LaunchModules {
  return {
    antiSnipe: false,
    antiSnipeDuration: 5,
    antiSnipeInitialTax: 98,
    backedFloor: false,
    floorAllocation: 10,
    antiMev: false,
    maxWallet: false,
    maxWalletBps: 200,
    maxTx: false,
    maxTxBps: 100,
    autoBurn: false,
    autoBurnPct: 20,
    deepenLps: false,
    deepenLpsPct: 20,
    holderAirdrop: false,
    holderAirdropPct: 50,
    creatorShareToHook: false,
    buybackVesting: true,
    buybackVestingDurationDays: 30,
    buybackVestingMcapUsd: 0,
    ...over,
  };
}

test("buyback until-mcap leaves bitmask duration unchanged (mcap lives in vestPacked)", () => {
  const packed = packLaunchBitmask(
    modules({ buybackVestingMcapUsd: 10_000_000, buybackVestingDurationDays: 14 }),
    0,
  );
  const unpacked = unpackLaunchBitmask(packed);
  assert.equal(unpacked.modules.buybackVesting, true);
  assert.equal(unpacked.modules.buybackVestingDurationDays, 14);
  assert.equal(unpacked.modules.buybackVestingMcapUsd, 0);
});

test("buyback time vest packs the chosen duration", () => {
  const packed = packLaunchBitmask(modules({ buybackVestingDurationDays: 14 }), 0);
  const unpacked = unpackLaunchBitmask(packed);
  assert.equal(unpacked.modules.buybackVestingDurationDays, 14);
  assert.equal(unpacked.modules.buybackVestingMcapUsd, 0);
});
