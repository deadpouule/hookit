import type { LaunchModules } from "@/lib/types";
import type { MasterHookId } from "@/lib/master-hooks";
import { formatDynamicFeeRange } from "@/lib/fee-range";
import { formatCompactQuoteAmount, formatCompactUsd, formatLiveQuoteWei } from "@/lib/format";
import {
  AIRDROP_STEP_PRESET_USD,
  BUYBACK_STEP_PRESET_USD,
  DEFAULT_MCAP_STEP_PCT,
  unlockedPctAtFdv,
} from "@/lib/mcap-vest";

export type ModuleLiveStats = {
  floorPriceHuman: number | null;
  /** DEX quote-per-token (same units as floorPriceHuman). */
  spotPriceHuman: number | null;
  floorReserveHuman: number | null;
  airdropPendingHuman: number | null;
  airdropSecondsLeft: number | null;
  airdropLastAtSec: number | null;
  airdropEpochSec: number | null;
  burnedPct: number | null;
  deepenLpsPendingHuman: number | null;
  buybackTotalHuman: number | null;
  buybackClaimableHuman: number | null;
  buybackClaimedHuman: number | null;
  buybackClaimableWei?: bigint | null;
  buybackQuoteDecimals?: number;
  buybackVestSecondsLeft: number | null;
  quoteLabel: string;
};

function formatAmount(value: number | null, quoteLabel: string): string {
  if (value == null) return "—";
  return `${formatCompactQuoteAmount(value)} ${quoteLabel}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Remaining vest time, including seconds so the hook can tick live. */
export function formatVestRemaining(seconds: number): string {
  if (seconds <= 0) return "unlocked";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m ${pad2(secs)}s`;
  if (hours > 0) return `${hours}h ${mins}m ${pad2(secs)}s`;
  if (mins > 0) return `${mins}m ${pad2(secs)}s`;
  return `${secs}s`;
}

/** Linear BuybackVault unlock minus already claimed. */
export function buybackClaimableWei(args: {
  amount: bigint;
  startSec: number;
  claimed: bigint;
  durationSec: number;
  nowSec: number;
}): bigint {
  const { amount, startSec, claimed, durationSec, nowSec } = args;
  if (amount <= 0n || startSec <= 0 || durationSec <= 0) return 0n;
  const elapsed = BigInt(Math.max(0, nowSec - startSec));
  const duration = BigInt(durationSec);
  const unlocked = elapsed >= duration ? amount : (amount * elapsed) / duration;
  return unlocked > claimed ? unlocked - claimed : 0n;
}

/**
 * Spot vs redeemable floor: `(spot - floor) / floor * 100`.
 * 1M mcap vs 100k floor-implied mcap → +900.
 * Null when either side is missing, or the vault is still dust vs spot
 * (e.g. $5k launch FDV vs a $0.01 vault would print tens of millions of %
 * and is not a real premium).
 */
const FLOOR_PREM_MIN_COVERAGE = 0.01;

export function floorPremiumPct(
  spot: number | null | undefined,
  floor: number | null | undefined,
): number | null {
  if (spot == null || floor == null) return null;
  if (!Number.isFinite(spot) || !Number.isFinite(floor) || spot <= 0 || floor <= 0) return null;
  if (floor / spot < FLOOR_PREM_MIN_COVERAGE) return null;
  const pct = ((spot - floor) / floor) * 100;
  if (!Number.isFinite(pct) || Math.abs(pct) >= 10_000) return null;
  return pct;
}

/** Compact chip label, e.g. `+900% prem`. Near-zero prints `at floor`. */
export function formatFloorPremiumPct(pct: number): string {
  if (!Number.isFinite(pct)) return "";
  if (Math.abs(pct) < 0.5) return "at floor";
  const rounded = Math.abs(pct) >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  const body = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${sign}${body}% prem`;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "ready";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export function moduleLiveStatLine(
  id: MasterHookId,
  modules: LaunchModules,
  live: ModuleLiveStats,
  pool: { launchedAt?: number; creator?: string; marketCap?: number },
  _hookTaxBps = 0,
): string | null {
  switch (id) {
    case "anti-snipe": {
      if (!pool.launchedAt) return null;
      const left = pool.launchedAt + modules.antiSnipeDuration - Math.floor(Date.now() / 1000);
      if (left <= 0) return null;
      return `${left}s left`;
    }
    case "backed-floor": {
      const vault = formatAmount(live.floorReserveHuman, live.quoteLabel);
      const floor =
        live.floorPriceHuman != null
          ? `${formatCompactQuoteAmount(live.floorPriceHuman)} ${live.quoteLabel}`
          : `0 ${live.quoteLabel}`;
      const prem = floorPremiumPct(live.spotPriceHuman, live.floorPriceHuman);
      const premPart = prem != null ? ` · ${formatFloorPremiumPct(prem)}` : "";
      return `${modules.floorAllocation}% · Vault ${vault} · Floor ${floor}${premPart}`;
    }
    case "anti-mev":
      return null;
    case "max-tx":
      return `Max ${(modules.maxTxBps / 100).toFixed(1)}% of supply per trade`;
    case "max-wallet":
      return `Max ${(modules.maxWalletBps / 100).toFixed(1)}% of supply per wallet`;
    case "dynamic-fees":
      return formatDynamicFeeRange(modules, _hookTaxBps);
    case "buyback-vesting": {
      const mcapUsd = modules.buybackVestingMcapUsd ?? 0;
      const days = modules.buybackVestingDurationDays ?? 365 * 5;
      const remain =
        live.buybackVestSecondsLeft != null
          ? formatVestRemaining(live.buybackVestSecondsLeft)
          : days >= 365
            ? `${Math.round(days / 365)}y left`
            : `${days}d left`;
      const claimable =
        live.buybackClaimableWei != null && live.buybackQuoteDecimals != null
          ? `${formatLiveQuoteWei(live.buybackClaimableWei, live.buybackQuoteDecimals)} ${live.quoteLabel}`
          : formatAmount(live.buybackClaimableHuman ?? 0, live.quoteLabel);
      const amountPart =
        live.buybackTotalHuman == null || live.buybackTotalHuman <= 0
          ? `0 ${live.quoteLabel}`
          : claimable;
      if (mcapUsd > 0) {
        const mode = modules.buybackVestingUnlockMode === "steps" ? "steps" : "all";
        const stepPct = modules.buybackVestingStepPct ?? [...DEFAULT_MCAP_STEP_PCT];
        const liveMcap = pool.marketCap;
        const unlocked =
          liveMcap != null && liveMcap > 0
            ? unlockedPctAtFdv({
                untilMcap: true,
                mode,
                cliffUsd: mcapUsd,
                stepUsd: BUYBACK_STEP_PRESET_USD,
                stepPct,
                fdvUsd: liveMcap,
              })
            : 0;
        if (mode === "steps") {
          if (liveMcap != null && liveMcap > 0) {
            return `${amountPart} · ${unlocked}% unlocked · ${formatCompactUsd(liveMcap)} FDV`;
          }
          return `${amountPart} · by % to ${formatCompactUsd(mcapUsd)} FDV`;
        }
        const goal = formatCompactUsd(mcapUsd);
        if (liveMcap != null && liveMcap > 0) {
          if (liveMcap >= mcapUsd) return `${amountPart} · hit ${goal} FDV`;
          return `${amountPart} · ${formatCompactUsd(liveMcap)} / ${goal} FDV`;
        }
        return `${amountPart} · until ${goal} FDV`;
      }
      return `${amountPart} · ${remain}`;
    }
    case "auto-burn":
      return `${(live.burnedPct ?? 0).toFixed(2)}% burned`;
    case "deepen-lps": {
      const pending = formatAmount(live.deepenLpsPendingHuman, live.quoteLabel);
      return `${modules.deepenLpsPct}% of hook fees · ${pending} queued to deepen LP`;
    }
    case "holder-airdrop": {
      const potHuman = live.airdropPendingHuman;
      const mcapUsd = modules.holderAirdropMcapUsd ?? 0;
      const mode = modules.holderAirdropUnlockMode === "steps" ? "steps" : "all";
      const mcapPart = (() => {
        if (mcapUsd <= 0) return "";
        const liveMcap = pool.marketCap;
        if (mode === "steps") {
          const unlocked =
            liveMcap != null && liveMcap > 0
              ? unlockedPctAtFdv({
                  untilMcap: true,
                  mode,
                  cliffUsd: mcapUsd,
                  stepUsd: AIRDROP_STEP_PRESET_USD,
                  stepPct: modules.holderAirdropStepPct ?? [...DEFAULT_MCAP_STEP_PCT],
                  fdvUsd: liveMcap,
                })
              : 0;
          if (liveMcap != null && liveMcap > 0) return ` · ${unlocked}% unlocked`;
          return ` · by % to ${formatCompactUsd(mcapUsd)}`;
        }
        if (liveMcap != null && liveMcap > 0) {
          if (liveMcap >= mcapUsd) return ` · hit ${formatCompactUsd(mcapUsd)} FDV`;
          return ` · ${formatCompactUsd(liveMcap)} / ${formatCompactUsd(mcapUsd)} FDV`;
        }
        return ` · until ${formatCompactUsd(mcapUsd)} FDV`;
      })();
      if (potHuman == null || potHuman <= 0) {
        return `${modules.holderAirdropPct}% of fees → holders${mcapPart}`;
      }
      const pot = formatAmount(potHuman, live.quoteLabel);
      if (live.airdropSecondsLeft == null) return `Pot ${pot}${mcapPart}`;
      if (live.airdropSecondsLeft <= 0) return `Pot ${pot} · ready${mcapPart}`;
      return `Pot ${pot} · in ${formatCountdown(live.airdropSecondsLeft)}${mcapPart}`;
    }
    case "creator-share-to-hook":
      return null;
    default:
      return null;
  }
}

export function moduleMeterPct(
  id: MasterHookId,
  modules: LaunchModules,
  pool: { launchedAt?: number; marketCap?: number },
  live: ModuleLiveStats,
): number | null {
  switch (id) {
    case "anti-snipe": {
      if (!pool.launchedAt || modules.antiSnipeDuration <= 0) return null;
      const left = pool.launchedAt + modules.antiSnipeDuration - Math.floor(Date.now() / 1000);
      if (left <= 0) return null;
      return ((modules.antiSnipeDuration - left) / modules.antiSnipeDuration) * 100;
    }
    case "auto-burn":
      return live.burnedPct ?? 0;
    case "buyback-vesting": {
      const mcapUsd = modules.buybackVestingMcapUsd ?? 0;
      if (mcapUsd > 0 && pool.marketCap != null && pool.marketCap > 0) {
        const mode = modules.buybackVestingUnlockMode === "steps" ? "steps" : "all";
        if (mode === "steps") {
          return unlockedPctAtFdv({
            untilMcap: true,
            mode,
            cliffUsd: mcapUsd,
            stepUsd: BUYBACK_STEP_PRESET_USD,
            stepPct: modules.buybackVestingStepPct ?? [...DEFAULT_MCAP_STEP_PCT],
            fdvUsd: pool.marketCap,
          });
        }
        return Math.max(0, Math.min(100, (pool.marketCap / mcapUsd) * 100));
      }
      if (live.buybackTotalHuman == null || live.buybackTotalHuman <= 0) return null;
      if (live.buybackVestSecondsLeft == null) return null;
      const duration = (modules.buybackVestingDurationDays ?? 365 * 5) * 86_400;
      if (duration <= 0) return null;
      return Math.max(0, Math.min(100, ((duration - live.buybackVestSecondsLeft) / duration) * 100));
    }
    case "holder-airdrop": {
      const mcapUsd = modules.holderAirdropMcapUsd ?? 0;
      if (mcapUsd > 0 && pool.marketCap != null && pool.marketCap > 0) {
        const mode = modules.holderAirdropUnlockMode === "steps" ? "steps" : "all";
        if (mode === "steps") {
          return unlockedPctAtFdv({
            untilMcap: true,
            mode,
            cliffUsd: mcapUsd,
            stepUsd: AIRDROP_STEP_PRESET_USD,
            stepPct: modules.holderAirdropStepPct ?? [...DEFAULT_MCAP_STEP_PCT],
            fdvUsd: pool.marketCap,
          });
        }
        return Math.max(0, Math.min(100, (pool.marketCap / mcapUsd) * 100));
      }
      if (live.airdropSecondsLeft == null) return null;
      const epoch = live.airdropEpochSec ?? 15 * 60;
      if (epoch <= 0) return null;
      if (live.airdropSecondsLeft <= 0) return 100;
      return Math.max(0, Math.min(100, ((epoch - live.airdropSecondsLeft) / epoch) * 100));
    }
    default:
      return null;
  }
}
