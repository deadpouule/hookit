import type { LaunchModules } from "@/lib/types";
import type { MasterHookId } from "@/lib/master-hooks";

export type ModuleLiveStats = {
  floorPriceHuman: number | null;
  floorReserveHuman: number | null;
  airdropPendingHuman: number | null;
  airdropSecondsLeft: number | null;
  airdropLastAtSec: number | null;
  airdropEpochSec: number | null;
  burnedPct: number | null;
  lpDonatePendingHuman: number | null;
  buybackTotalHuman: number | null;
  buybackClaimableHuman: number | null;
  buybackClaimedHuman: number | null;
  buybackVestSecondsLeft: number | null;
  quoteLabel: string;
};

function formatAmount(value: number | null, quoteLabel: string, digits = 4): string {
  if (value == null) return "—";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: digits })} ${quoteLabel}`;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "unlocked";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
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
  pool: { launchedAt?: number; creator?: string },
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
          ? `${live.floorPriceHuman.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${live.quoteLabel}`
          : `0 ${live.quoteLabel}`;
      return `${modules.floorAllocation}% · Vault ${vault} · Floor ${floor}`;
    }
    case "anti-mev":
      return null;
    case "max-tx":
      return `Max ${(modules.maxTxBps / 100).toFixed(1)}% of supply per trade`;
    case "max-wallet":
      return `Max ${(modules.maxWalletBps / 100).toFixed(1)}% of supply per wallet`;
    case "dynamic-fees":
      return "Swap fee adjusts with volume";
    case "buyback-vesting": {
      const days = modules.buybackVestingDurationDays ?? 365 * 5;
      if (live.buybackTotalHuman == null || live.buybackTotalHuman <= 0) {
        return days >= 365
          ? `Unlocks over ${Math.round(days / 365)} years`
          : `Unlocks over ${days} days`;
      }
      const claimable = live.buybackClaimableHuman ?? 0;
      if (claimable > 0) {
        return `${formatAmount(claimable, live.quoteLabel)} ready to claim`;
      }
      const vest =
        live.buybackVestSecondsLeft != null ? formatDuration(live.buybackVestSecondsLeft) : null;
      return vest
        ? `${formatAmount(live.buybackTotalHuman, live.quoteLabel)} locked · ${vest}`
        : `${formatAmount(live.buybackTotalHuman, live.quoteLabel)} locked`;
    }
    case "auto-burn":
      return `${(live.burnedPct ?? 0).toFixed(2)}% burned`;
    case "lp-donate": {
      const pending = formatAmount(live.lpDonatePendingHuman, live.quoteLabel);
      return `${modules.lpDonatePct}% of hook fees · ${pending} queued for LPs`;
    }
    case "holder-airdrop": {
      const potHuman = live.airdropPendingHuman;
      if (potHuman == null || potHuman <= 0) {
        return `${modules.holderAirdropPct}% of fees → holders`;
      }
      const pot = formatAmount(potHuman, live.quoteLabel);
      if (live.airdropSecondsLeft == null) return `Pot ${pot}`;
      if (live.airdropSecondsLeft <= 0) return `Pot ${pot} · ready`;
      return `Pot ${pot} · in ${formatCountdown(live.airdropSecondsLeft)}`;
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
  pool: { launchedAt?: number },
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
      if (live.buybackTotalHuman == null || live.buybackTotalHuman <= 0) return null;
      if (live.buybackVestSecondsLeft == null) return null;
      const duration = (modules.buybackVestingDurationDays ?? 365 * 5) * 86_400;
      if (duration <= 0) return null;
      return Math.max(0, Math.min(100, ((duration - live.buybackVestSecondsLeft) / duration) * 100));
    }
    case "holder-airdrop": {
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
