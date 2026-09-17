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
    maxTx: false,
    maxTxBps: 100,
    autoBurn: false,
    autoBurnPct: 20,
    deepenLps: false,
    deepenLpsPct: 20,
    holderAirdrop: false,
    holderAirdropPct: 50,
    creatorShareToHook: false,
    hookToCreator: false,
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

test("hook-to-creator packs 100% and round-trips", () => {
  const packed = packLaunchBitmask(
    modules({
      buybackVesting: false,
      hookToCreator: true,
      hookToCreatorPct: 100,
    }),
    200,
  );
  const unpacked = unpackLaunchBitmask(packed);
  assert.equal(unpacked.modules.hookToCreator, true);
  assert.equal(unpacked.modules.hookToCreatorPct, 100);
  assert.equal(unpacked.hookTaxBps, 200);
});

test("hook tax without a destination refuses to pack", () => {
  assert.throws(
    () => packLaunchBitmask(modules({ buybackVesting: false }), 200),
    /destination/i,
  );
});
