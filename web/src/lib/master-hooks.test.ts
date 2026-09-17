import assert from "node:assert/strict";
import test from "node:test";

import { packLaunchBitmask } from "./bitmask";
import { DEFAULT_LAUNCH_STATE, DEFAULT_MASTER_WIZARD_STATE } from "./constants";
import {
  countHookUsage,
  masterHookIdsForPool,
  parseLaunchHookIds,
  poolEnablesMasterHook,
  withMasterHooksEnabled,
} from "./master-hooks";
import type { LaunchModules, TokenPool } from "./types";

const OFF_MODULES: LaunchModules = {
  ...DEFAULT_LAUNCH_STATE.modules,
  antiSnipe: false,
  backedFloor: false,
  antiMev: false,
  maxTx: false,
  autoBurn: false,
  deepenLps: false,
  holderAirdrop: false,
  buybackVesting: false,
  dynamicFees: false,
    creatorShareToHook: false,
    hookToCreator: false,
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
    { ...OFF_MODULES, holderAirdrop: true, holderAirdropPct: 100, maxTx: true, dynamicFees: true },
    200,
  ).toString();
  const row = pool({
    hookType: "Master",
    hooks: { antiSnipe: false, backedFloor: false, antiMev: false, customHook: false },
    bitmask,
  });
  assert.equal(poolEnablesMasterHook(row, "holder-airdrop"), true);
  assert.equal(poolEnablesMasterHook(row, "max-tx"), true);
  assert.equal(poolEnablesMasterHook(row, "dynamic-fees"), true);
  assert.equal(poolEnablesMasterHook(row, "auto-burn"), false);
  assert.deepEqual(masterHookIdsForPool(row).sort(), ["dynamic-fees", "holder-airdrop", "max-tx"]);
});

test("parseLaunchHookIds merges ?hooks= and ?hook=", () => {
  assert.deepEqual(parseLaunchHookIds("anti-snipe", "backed-floor,auto-burn"), [
    "backed-floor",
    "auto-burn",
    "anti-snipe",
  ]);
  assert.deepEqual(parseLaunchHookIds("anti-snipe", "anti-snipe"), ["anti-snipe"]);
});

test("withMasterHooksEnabled turns on each module from a combo query", () => {
  const next = withMasterHooksEnabled(DEFAULT_MASTER_WIZARD_STATE, [
    "anti-snipe",
    "max-tx",
    "fixed-fee",
  ]);
  assert.equal(next.modules.antiSnipe, true);
  assert.equal(next.modules.maxTx, true);
  assert.equal(next.modules.dynamicFees, false);
  assert.equal(next.hookTaxBps, 50);
  assert.equal(next.hookMode, "master");
});
