import assert from "node:assert/strict";
import test from "node:test";

import { packLaunchBitmask } from "./bitmask";
import { DEFAULT_LAUNCH_STATE } from "./constants";
import { countHookUsage, masterHookIdsForPool, poolEnablesMasterHook } from "./master-hooks";
import type { LaunchModules, TokenPool } from "./types";

const OFF_MODULES: LaunchModules = {
  ...DEFAULT_LAUNCH_STATE.modules,
  antiSnipe: false,
  backedFloor: false,
  antiMev: false,
  maxWallet: false,
  maxTx: false,
  autoBurn: false,
  deepenLps: false,
  holderAirdrop: false,
  buybackVesting: false,
  dynamicFees: false,
  creatorShareToHook: false,
};

function pool(overrides: Partial<TokenPool> & { hooks: TokenPool["hooks"]; hookType?: TokenPool["hookType"] }): TokenPool {
  return {
    id: "0x1",
    name: "T",
    ticker: "T",
    image: "",
    banner: "",
    marketCap: 0,
    floorValue: 0,
    liquidity: 0,
    change24h: 0,
    address: "0x1",
    bannerGradient: "",
    hookType: "Master",
    ...overrides,
  };
}

test("countHookUsage reads modules when hook flags are empty", () => {
  const usage = countHookUsage([
    pool({
      hookType: "Master",
      hooks: { antiSnipe: false, backedFloor: false, antiMev: false, customHook: false },
      modules: { ...OFF_MODULES, autoBurn: true, deepenLps: true },
    }),
    pool({
      hookType: "Classic",
      hooks: { antiSnipe: false, backedFloor: false, antiMev: false, customHook: false },
      modules: { ...OFF_MODULES, autoBurn: true },
    }),
  ]);
  assert.equal(usage["auto-burn"], 1);
  assert.equal(usage["deepen-lps"], 1);
  assert.equal(usage["anti-snipe"], 0);
});

test("poolEnablesMasterHook unpacks bitmask when flags were stripped", () => {
  const bitmask = packLaunchBitmask(
    { ...OFF_MODULES, holderAirdrop: true, holderAirdropPct: 100, maxWallet: true, dynamicFees: true },
    200,
  ).toString();
  const row = pool({
    hookType: "Master",
    hooks: { antiSnipe: false, backedFloor: false, antiMev: false, customHook: false },
    bitmask,
  });
  assert.equal(poolEnablesMasterHook(row, "holder-airdrop"), true);
  assert.equal(poolEnablesMasterHook(row, "max-wallet"), true);
  assert.equal(poolEnablesMasterHook(row, "dynamic-fees"), true);
  assert.equal(poolEnablesMasterHook(row, "auto-burn"), false);
  assert.deepEqual(masterHookIdsForPool(row).sort(), ["dynamic-fees", "holder-airdrop", "max-wallet"]);
});
