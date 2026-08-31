import type { LaunchModules } from "@/lib/types";
import type { MasterHookId } from "@/lib/master-hooks";
import { formatAge } from "@/lib/format";

export type ModuleLiveStats = {
  floorPriceHuman: number | null;
  floorReserveHuman: number | null;
  airdropPendingHuman: number | null;
  airdropSecondsLeft: number | null;
  airdropLastAtSec: number | null;
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
  hookTaxBps = 0,
): string | null {
  switch (id) {
    case "anti-snipe": {
      if (!pool.launchedAt) return `${modules.antiSnipeInitialTax}% tax at launch`;
      const left = pool.launchedAt + modules.antiSnipeDuration - Math.floor(Date.now() / 1000);
      if (left <= 0) return "Protection ended";
      return `${left}s left · ${modules.antiSnipeInitialTax}% tax`;
    }
    case "backed-floor":
      return `Vault ${formatAmount(live.floorReserveHuman, live.quoteLabel)} · floor ${formatAmount(live.floorPriceHuman, live.quoteLabel, 6)}`;
    case "anti-mev":
      return "Same-block bot trades blocked";
    case "max-tx":
      return `Max ${(modules.maxTxBps / 100).toFixed(1)}% of supply per trade`;
    case "max-wallet":
      return `Max ${(modules.maxWalletBps / 100).toFixed(1)}% of supply per wallet`;
    case "dynamic-fees":
      return "Swap fee adjusts with volume";
    case "buyback-vesting": {
      if (live.buybackTotalHuman == null || live.buybackTotalHuman <= 0) {
        const days = modules.buybackVestingDurationDays ?? 365 * 5;
        return days >= 365
          ? `Creator fees vest over ${(days / 365).toFixed(1)} years`
          : `Creator fees vest over ${days} days`;
      }
      const claimable = formatAmount(live.buybackClaimableHuman, live.quoteLabel);
      const claimed = formatAmount(live.buybackClaimedHuman, live.quoteLabel);
      const vest =
        live.buybackVestSecondsLeft != null
          ? formatDuration(live.buybackVestSecondsLeft)
          : "—";
      return `${formatAmount(live.buybackTotalHuman, live.quoteLabel)} vesting · ${claimable} claimable · ${claimed} claimed · ${vest}`;
    }
    case "auto-burn":
      return live.burnedPct != null
        ? `${live.burnedPct.toFixed(2)}% supply burned · ${modules.autoBurnPct}% of fees`
        : `${modules.autoBurnPct}% of fees burned on swaps`;
    case "lp-donate": {
      const pending = formatAmount(live.lpDonatePendingHuman, live.quoteLabel);
      return `${modules.lpDonatePct}% of hook fees · ${pending} queued for LPs`;
    }
    case "holder-airdrop": {
      const pot = formatAmount(live.airdropPendingHuman, live.quoteLabel);
      const next =
        live.airdropSecondsLeft == null
          ? "—"
          : live.airdropSecondsLeft <= 0
            ? "ready to drop"
            : formatCountdown(live.airdropSecondsLeft);
      const last =
        live.airdropLastAtSec != null && live.airdropLastAtSec > 0
          ? `last drop ${formatAge(Math.floor(Date.now() / 1000) - live.airdropLastAtSec)} ago`
          : "no drop yet";
      return `${modules.holderAirdropPct}% of fees · pot ${pot} · next ${next} · ${last}`;
    }
    case "creator-share-to-hook": {
      const hookTax =
        hookTaxBps > 0 ? `${(hookTaxBps / 100).toFixed(1)}% hook tax active` : "no extra hook tax";
      return `70% of base fee → hook pot · ${hookTax}`;
    }
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
      if (live.airdropSecondsLeft <= 0) return 100;
      return ((15 * 60 - live.airdropSecondsLeft) / (15 * 60)) * 100;
    }
    default:
      return null;
  }
}
