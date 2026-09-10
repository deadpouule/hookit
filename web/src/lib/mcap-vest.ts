/** On-chain `McapVest` packing — keep in sync with `src/libraries/McapVest.sol`. */

export const MCAP_VEST_KIND_TIME = 0;
export const MCAP_VEST_KIND_CLIFF = 1;
export const MCAP_VEST_KIND_STEPS = 2;
export const MCAP_VEST_MAX_STEPS = 6;

/** 5M, 10M, 50M, 100M, 500M, 1B, 10B whole USD. */
export const MCAP_VEST_PRESET_USD = [
  5_000_000, 10_000_000, 50_000_000, 100_000_000, 500_000_000, 1_000_000_000, 10_000_000_000,
] as const;

export const BUYBACK_MCAP_PRESET_USD = MCAP_VEST_PRESET_USD.slice(1);
export const AIRDROP_MCAP_PRESET_USD = [...MCAP_VEST_PRESET_USD];
export const BUYBACK_STEP_PRESET_USD = BUYBACK_MCAP_PRESET_USD;
export const AIRDROP_STEP_PRESET_USD = [
  5_000_000, 10_000_000, 50_000_000, 100_000_000, 1_000_000_000, 10_000_000_000,
] as const;

export const DEFAULT_MCAP_STEP_PCT = [5, 5, 15, 20, 25, 30] as const;

export type McapUnlockMode = "all" | "steps";

export type McapVestPlan = {
  kind: number;
  durationSeconds: number;
  cliffPreset: number;
  stepCount: number;
  steps: { preset: number; pct: number }[];
};

export function formatMcapPreset(usd: number): string {
  if (usd >= 1_000_000_000) return `$${usd / 1_000_000_000}B`;
  return `$${usd / 1_000_000}M`;
}

export function presetIndexForUsd(usd: number): number {
  const idx = MCAP_VEST_PRESET_USD.indexOf(usd as (typeof MCAP_VEST_PRESET_USD)[number]);
  if (idx >= 0) return idx;
  let best = 0;
  for (let i = 0; i < MCAP_VEST_PRESET_USD.length; i++) {
    if (MCAP_VEST_PRESET_USD[i] <= usd) best = i;
  }
  return best;
}

export function emptyPlan(): McapVestPlan {
  return {
    kind: MCAP_VEST_KIND_TIME,
    durationSeconds: 0,
    cliffPreset: 0,
    stepCount: 0,
    steps: Array.from({ length: MCAP_VEST_MAX_STEPS }, () => ({ preset: 0, pct: 0 })),
  };
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function stepPctSum(pct: number[]): number {
  return pct.slice(0, MCAP_VEST_MAX_STEPS).reduce((acc, n) => acc + clampPct(n), 0);
}

export function assertStepPctSum(pct: number[]): void {
  const sum = stepPctSum(pct);
  if (sum !== 100) {
    throw new Error(`Mcap unlock percents must add to 100 (got ${sum})`);
  }
}

export function packPlan(plan: McapVestPlan): bigint {
  let packed = BigInt(plan.kind & 3);
  packed |= BigInt(plan.durationSeconds >>> 0) << 2n;
  packed |= BigInt(plan.cliffPreset & 7) << 34n;
  packed |= BigInt(plan.stepCount & 7) << 37n;
  let cursor = 40n;
  for (let i = 0; i < MCAP_VEST_MAX_STEPS; i++) {
    const step = plan.steps[i] ?? { preset: 0, pct: 0 };
    const raw = BigInt(step.preset & 7) | (BigInt(clampPct(step.pct)) << 3n);
    packed |= raw << cursor;
    cursor += 11n;
  }
  return packed;
}

export function unpackPlan(packed: bigint): McapVestPlan {
  const plan = emptyPlan();
  plan.kind = Number(packed & 3n);
  plan.durationSeconds = Number((packed >> 2n) & 0xffffffffn);
  plan.cliffPreset = Number((packed >> 34n) & 7n);
  plan.stepCount = Number((packed >> 37n) & 7n);
  let cursor = 40n;
  for (let i = 0; i < MCAP_VEST_MAX_STEPS; i++) {
    const raw = Number((packed >> cursor) & 0x7ffn);
    plan.steps[i] = { preset: raw & 7, pct: raw >> 3 };
    cursor += 11n;
  }
  return plan;
}

export function joinVestPacked(buyback: bigint, airdrop: bigint): bigint {
  return (buyback & ((1n << 128n) - 1n)) | (airdrop << 128n);
}

export function splitVestPacked(packed: bigint): { buyback: bigint; airdrop: bigint } {
  const mask = (1n << 128n) - 1n;
  return { buyback: packed & mask, airdrop: packed >> 128n };
}

function cliffPlan(preset: number): McapVestPlan {
  const plan = emptyPlan();
  plan.kind = MCAP_VEST_KIND_CLIFF;
  plan.cliffPreset = preset;
  return plan;
}

function stepsPlan(usdRungs: readonly number[], pcts: number[]): McapVestPlan {
  const plan = emptyPlan();
  plan.kind = MCAP_VEST_KIND_STEPS;
  plan.stepCount = Math.min(MCAP_VEST_MAX_STEPS, usdRungs.length);
  for (let i = 0; i < plan.stepCount; i++) {
    plan.steps[i] = { preset: presetIndexForUsd(usdRungs[i]!), pct: clampPct(pcts[i] ?? 0) };
  }
  return plan;
}

export function packBuybackVestSlice(args: {
  untilMcap: boolean;
  mode: McapUnlockMode;
  cliffUsd: number;
  stepPct: number[];
}): bigint {
  if (!args.untilMcap) return 0n;
  if (args.mode === "all") return packPlan(cliffPlan(Math.max(1, presetIndexForUsd(args.cliffUsd))));
  assertStepPctSum(args.stepPct);
  return packPlan(stepsPlan(BUYBACK_STEP_PRESET_USD, args.stepPct));
}

export function packAirdropVestSlice(args: {
  untilMcap: boolean;
  mode: McapUnlockMode;
  cliffUsd: number;
  stepPct: number[];
}): bigint {
  if (!args.untilMcap) return 0n;
  if (args.mode === "all") return packPlan(cliffPlan(presetIndexForUsd(args.cliffUsd)));
  assertStepPctSum(args.stepPct);
  return packPlan(stepsPlan(AIRDROP_STEP_PRESET_USD, args.stepPct));
}

export function packVestPackedFromModules(modules: {
  buybackVesting?: boolean;
  buybackVestingMcapUsd?: number;
  buybackVestingUnlockMode?: McapUnlockMode;
  buybackVestingStepPct?: number[];
  holderAirdrop?: boolean;
  holderAirdropMcapUsd?: number;
  holderAirdropUnlockMode?: McapUnlockMode;
  holderAirdropStepPct?: number[];
}): bigint {
  const buyback = modules.buybackVesting
    ? packBuybackVestSlice({
        untilMcap: (modules.buybackVestingMcapUsd ?? 0) > 0,
        mode: modules.buybackVestingUnlockMode === "steps" ? "steps" : "all",
        cliffUsd: modules.buybackVestingMcapUsd ?? 0,
        stepPct: modules.buybackVestingStepPct ?? [...DEFAULT_MCAP_STEP_PCT],
      })
    : 0n;
  const airdrop = modules.holderAirdrop
    ? packAirdropVestSlice({
        untilMcap: (modules.holderAirdropMcapUsd ?? 0) > 0,
        mode: modules.holderAirdropUnlockMode === "steps" ? "steps" : "all",
        cliffUsd: modules.holderAirdropMcapUsd ?? 0,
        stepPct: modules.holderAirdropStepPct ?? [...DEFAULT_MCAP_STEP_PCT],
      })
    : 0n;
  return joinVestPacked(buyback, airdrop);
}

export function applyVestPackedToModules<T extends {
  buybackVesting?: boolean;
  holderAirdrop?: boolean;
  buybackVestingMcapUsd?: number;
  buybackVestingUnlockMode?: McapUnlockMode;
  buybackVestingStepPct?: number[];
  holderAirdropMcapUsd?: number;
  holderAirdropUnlockMode?: McapUnlockMode;
  holderAirdropStepPct?: number[];
}>(modules: T, packed: bigint): T {
  if (packed === 0n) return modules;
  const { buyback, airdrop } = splitVestPacked(packed);
  const next = { ...modules };
  if (buyback !== 0n && modules.buybackVesting) {
    const plan = unpackPlan(buyback);
    if (plan.kind === MCAP_VEST_KIND_CLIFF) {
      next.buybackVestingMcapUsd = MCAP_VEST_PRESET_USD[plan.cliffPreset];
      next.buybackVestingUnlockMode = "all";
    } else if (plan.kind === MCAP_VEST_KIND_STEPS) {
      next.buybackVestingUnlockMode = "steps";
      next.buybackVestingStepPct = plan.steps.slice(0, plan.stepCount).map((s) => s.pct);
      next.buybackVestingMcapUsd = BUYBACK_STEP_PRESET_USD[BUYBACK_STEP_PRESET_USD.length - 1];
    }
  }
  if (airdrop !== 0n && modules.holderAirdrop) {
    const plan = unpackPlan(airdrop);
    if (plan.kind === MCAP_VEST_KIND_CLIFF) {
      next.holderAirdropMcapUsd = MCAP_VEST_PRESET_USD[plan.cliffPreset];
      next.holderAirdropUnlockMode = "all";
    } else if (plan.kind === MCAP_VEST_KIND_STEPS) {
      next.holderAirdropUnlockMode = "steps";
      next.holderAirdropStepPct = plan.steps.slice(0, plan.stepCount).map((s) => s.pct);
      next.holderAirdropMcapUsd = AIRDROP_STEP_PRESET_USD[AIRDROP_STEP_PRESET_USD.length - 1];
    }
  }
  return next;
}

/** Unlocked percent (0–100) at a live FDV. Time vest returns 0 so callers keep duration UI. */
export function unlockedPctAtFdv(args: {
  untilMcap: boolean;
  mode: McapUnlockMode;
  cliffUsd: number;
  stepUsd: readonly number[];
  stepPct: number[];
  fdvUsd: number;
}): number {
  if (!args.untilMcap) return 0;
  if (args.mode === "all") return args.fdvUsd >= args.cliffUsd ? 100 : 0;
  let acc = 0;
  const n = Math.min(args.stepUsd.length, args.stepPct.length, MCAP_VEST_MAX_STEPS);
  for (let i = 0; i < n; i++) {
    if (args.fdvUsd >= (args.stepUsd[i] ?? 0)) acc += clampPct(args.stepPct[i] ?? 0);
  }
  return Math.min(100, acc);
}
