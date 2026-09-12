import assert from "node:assert/strict";
import test from "node:test";

import {
  AIRDROP_STEP_PRESET_USD,
  BUYBACK_STEP_PRESET_USD,
  DEFAULT_MCAP_STEP_PCT,
  EMPTY_MCAP_STEP_PCT,
  MCAP_VEST_KIND_CLIFF,
  MCAP_VEST_KIND_STEPS,
  MCAP_VEST_PRESET_USD,
  applyVestPackedToModules,
  formatMcapPreset,
  joinVestPacked,
  packAirdropVestSlice,
  packBuybackVestSlice,
  packPlan,
  packVestPackedFromModules,
  mcapStepUnlockError,
  splitVestPacked,
  unpackPlan,
  unlockedPctAtFdv,
} from "./mcap-vest";
import type { LaunchModules } from "./types";

test("presets are 5M through 10B", () => {
  assert.deepEqual([...MCAP_VEST_PRESET_USD], [
    5_000_000, 10_000_000, 50_000_000, 100_000_000, 500_000_000, 1_000_000_000, 10_000_000_000,
  ]);
  assert.equal(formatMcapPreset(10_000_000), "$10M");
  assert.equal(formatMcapPreset(1_000_000_000), "$1B");
  assert.equal(formatMcapPreset(10_000_000_000), "$10B");
});

test("buyback cliff 10M round-trips in vestPacked", () => {
  const slice = packBuybackVestSlice({
    untilMcap: true,
    mode: "all",
    cliffUsd: 10_000_000,
    stepPct: [...DEFAULT_MCAP_STEP_PCT],
  });
  const plan = unpackPlan(slice);
  assert.equal(plan.kind, MCAP_VEST_KIND_CLIFF);
  assert.equal(plan.cliffPreset, 1);
  const packed = joinVestPacked(slice, 0n);
  const modules = applyVestPackedToModules(
    { buybackVesting: true, holderAirdrop: false } as LaunchModules,
    packed,
  );
  assert.equal(modules.buybackVestingMcapUsd, 10_000_000);
  assert.equal(modules.buybackVestingUnlockMode, "all");
});

test("buyback 5M cliff snaps to 10M minimum", () => {
  const slice = packBuybackVestSlice({
    untilMcap: true,
    mode: "all",
    cliffUsd: 5_000_000,
    stepPct: [...DEFAULT_MCAP_STEP_PCT],
  });
  assert.equal(unpackPlan(slice).cliffPreset, 1);
});

test("buyback steps pack percents that sum to 100", () => {
  const slice = packBuybackVestSlice({
    untilMcap: true,
    mode: "steps",
    cliffUsd: 10_000_000,
    stepPct: [...DEFAULT_MCAP_STEP_PCT],
  });
  const plan = unpackPlan(slice);
  assert.equal(plan.kind, MCAP_VEST_KIND_STEPS);
  assert.equal(plan.stepCount, 6);
  assert.deepEqual(
    plan.steps.slice(0, 6).map((s) => s.pct),
    [...DEFAULT_MCAP_STEP_PCT],
  );
  assert.equal(MCAP_VEST_PRESET_USD[plan.steps[0]!.preset], BUYBACK_STEP_PRESET_USD[0]);
});

test("airdrop cliff may use 5M", () => {
  const slice = packAirdropVestSlice({
    untilMcap: true,
    mode: "all",
    cliffUsd: 5_000_000,
    stepPct: [...DEFAULT_MCAP_STEP_PCT],
  });
  assert.equal(unpackPlan(slice).cliffPreset, 0);
});

test("join/split keeps buyback and airdrop independent", () => {
  const buyback = packBuybackVestSlice({
    untilMcap: true,
    mode: "all",
    cliffUsd: 50_000_000,
    stepPct: [...DEFAULT_MCAP_STEP_PCT],
  });
  const airdrop = packAirdropVestSlice({
    untilMcap: true,
    mode: "all",
    cliffUsd: 5_000_000,
    stepPct: [...DEFAULT_MCAP_STEP_PCT],
  });
  const packed = joinVestPacked(buyback, airdrop);
  const split = splitVestPacked(packed);
  assert.equal(split.buyback, buyback);
  assert.equal(split.airdrop, airdrop);
});

test("mcapStepUnlockError flags empty By % unlocks", () => {
  assert.equal(mcapStepUnlockError({}), null);
  assert.equal(
    mcapStepUnlockError({
      buybackVesting: true,
      buybackVestingMcapUsd: 10_000_000,
      buybackVestingUnlockMode: "steps",
      buybackVestingStepPct: [...EMPTY_MCAP_STEP_PCT],
    }),
    "Buyback vesting unlock percents must add to 100%.",
  );
  assert.equal(
    mcapStepUnlockError({
      buybackVesting: true,
      buybackVestingMcapUsd: 10_000_000,
      buybackVestingUnlockMode: "steps",
      buybackVestingStepPct: [...DEFAULT_MCAP_STEP_PCT],
    }),
    null,
  );
});

test("packVestPackedFromModules throws when step percents miss 100", () => {
  assert.throws(
    () =>
      packVestPackedFromModules({
        buybackVesting: true,
        buybackVestingMcapUsd: 10_000_000,
        buybackVestingUnlockMode: "steps",
        buybackVestingStepPct: [5, 5, 5, 5, 5, 5],
      }),
    /add to 100/,
  );
});

test("time vest packs as zero", () => {
  assert.equal(
    packVestPackedFromModules({
      buybackVesting: true,
      buybackVestingMcapUsd: 0,
      holderAirdrop: true,
      holderAirdropMcapUsd: 0,
    }),
    0n,
  );
});

test("unlockedPctAtFdv matches cliff and steps", () => {
  assert.equal(
    unlockedPctAtFdv({
      untilMcap: true,
      mode: "all",
      cliffUsd: 10_000_000,
      stepUsd: BUYBACK_STEP_PRESET_USD,
      stepPct: [...DEFAULT_MCAP_STEP_PCT],
      fdvUsd: 9_999_999,
    }),
    0,
  );
  assert.equal(
    unlockedPctAtFdv({
      untilMcap: true,
      mode: "all",
      cliffUsd: 10_000_000,
      stepUsd: BUYBACK_STEP_PRESET_USD,
      stepPct: [...DEFAULT_MCAP_STEP_PCT],
      fdvUsd: 10_000_000,
    }),
    100,
  );
  assert.equal(
    unlockedPctAtFdv({
      untilMcap: true,
      mode: "steps",
      cliffUsd: 10_000_000,
      stepUsd: BUYBACK_STEP_PRESET_USD,
      stepPct: [...DEFAULT_MCAP_STEP_PCT],
      fdvUsd: 10_000_000,
    }),
    5,
  );
  assert.equal(
    unlockedPctAtFdv({
      untilMcap: true,
      mode: "steps",
      cliffUsd: 10_000_000,
      stepUsd: BUYBACK_STEP_PRESET_USD,
      stepPct: [...DEFAULT_MCAP_STEP_PCT],
      fdvUsd: 50_000_000,
    }),
    10,
  );
  assert.equal(
    unlockedPctAtFdv({
      untilMcap: true,
      mode: "steps",
      cliffUsd: 5_000_000,
      stepUsd: AIRDROP_STEP_PRESET_USD,
      stepPct: [...DEFAULT_MCAP_STEP_PCT],
      fdvUsd: 5_000_000,
    }),
    5,
  );
});

test("packPlan round-trips duration and two steps", () => {
  const packed = packPlan({
    kind: MCAP_VEST_KIND_STEPS,
    durationSeconds: 7 * 86_400,
    cliffPreset: 0,
    stepCount: 2,
    steps: [
      { preset: 1, pct: 40 },
      { preset: 6, pct: 60 },
      { preset: 0, pct: 0 },
      { preset: 0, pct: 0 },
      { preset: 0, pct: 0 },
      { preset: 0, pct: 0 },
    ],
  });
  const out = unpackPlan(packed);
  assert.equal(out.kind, MCAP_VEST_KIND_STEPS);
  assert.equal(out.durationSeconds, 7 * 86_400);
  assert.equal(out.stepCount, 2);
  assert.equal(out.steps[0]?.preset, 1);
  assert.equal(out.steps[0]?.pct, 40);
  assert.equal(out.steps[1]?.pct, 60);
});
