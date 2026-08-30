"use client";

import { useMemo } from "react";
import { formatUnits, zeroAddress, type Address } from "viem";
import { useReadContract } from "wagmi";

import { MasterHookAsciiIcon } from "@/components/home/market/MasterHookAsciiIcon";
import { getLaunchFactoryAddress, STABLE_QUOTE_ADDRESS } from "@/lib/contracts/config";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { holderAirdropVaultAbi } from "@/lib/contracts/holder-airdrop-vault-abi";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { masterLaunchHookAbi } from "@/lib/contracts/master-launch-hook-abi";
import { floorVaultAbi } from "@/lib/contracts/swap-abi";
import { unpackLaunchBitmask } from "@/lib/bitmask";
import {
  hookTaxSummary,
  isModuleEnabled,
  moduleDetailLine,
  totalFeeSummary,
} from "@/lib/launch-module-summary";
import {
  MASTER_HOOKS,
  type MasterHookId,
} from "@/lib/master-hooks";
import { poolQuoteLabel } from "@/lib/payment-assets";
import { TOTAL_SUPPLY } from "@/lib/token-live";
import type { LaunchModules, TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

const LAUNCH_SUPPLY_WEI = BigInt(TOTAL_SUPPLY) * 10n ** 18n;

function quoteDecimals(quote: Address): number {
  if (quote === zeroAddress) return 18;
  if (quote.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase()) return 6;
  return 18;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Ready";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

function resolveModules(pool: TokenPool): { modules: LaunchModules; hookTaxBps: number } | null {
  if (pool.modules) {
    return { modules: pool.modules, hookTaxBps: pool.hookTaxBps ?? 0 };
  }
  if (pool.bitmask) {
    try {
      return unpackLaunchBitmask(BigInt(pool.bitmask));
    } catch {
      return null;
    }
  }
  return null;
}

type LiveBits = {
  floorPriceHuman: number | null;
  floorReserveHuman: number | null;
  airdropPendingHuman: number | null;
  airdropSecondsLeft: number | null;
  burnedPct: number | null;
  quoteLabel: string;
};

function liveStatusForHook(
  id: MasterHookId,
  modules: LaunchModules,
  pool: TokenPool,
  live: LiveBits,
): string | null {
  switch (id) {
    case "anti-snipe": {
      if (!pool.launchedAt) return "Decay tax on opening buys";
      const endsAt = pool.launchedAt + modules.antiSnipeDuration;
      const left = endsAt - Math.floor(Date.now() / 1000);
      if (left <= 0) return "Window closed";
      return `${left}s left · ${modules.antiSnipeInitialTax}% open tax`;
    }
    case "backed-floor": {
      if (live.floorPriceHuman == null && live.floorReserveHuman == null) {
        return `${modules.floorAllocation}% of fees → vault`;
      }
      const price =
        live.floorPriceHuman != null
          ? `${live.floorPriceHuman.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${live.quoteLabel}`
          : "—";
      const reserve =
        live.floorReserveHuman != null
          ? `${live.floorReserveHuman.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${live.quoteLabel}`
          : "—";
      return `P_floor ${price} · vault ${reserve}`;
    }
    case "anti-mev":
      return "Same-block opposing swaps blocked";
    case "max-tx":
      return `Cap ${(modules.maxTxBps / 100).toFixed(1)}% supply / swap`;
    case "max-wallet":
      return `Cap ${(modules.maxWalletBps / 100).toFixed(1)}% supply / wallet`;
    case "dynamic-fees":
      return "Volatility-adjusted LP fee flag";
    case "buyback-vesting": {
      const days = modules.buybackVestingDurationDays ?? 365 * 5;
      return days >= 365
        ? `Creator fees vest ${(days / 365).toFixed(1)}y`
        : `Creator fees vest ${days}d`;
    }
    case "auto-burn": {
      if (live.burnedPct == null) return `${modules.autoBurnPct}% of fees → burn`;
      return `${live.burnedPct.toFixed(2)}% supply burned · ${modules.autoBurnPct}% of fees`;
    }
    case "lp-donate":
      return `${modules.lpDonatePct}% of fees → in-range LPs`;
    case "holder-airdrop": {
      const pot =
        live.airdropPendingHuman != null
          ? `${live.airdropPendingHuman.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${live.quoteLabel}`
          : "—";
      const window =
        live.airdropSecondsLeft == null ? "—" : formatCountdown(live.airdropSecondsLeft);
      return `Pot ${pot} · next ${window}`;
    }
    case "creator-share-to-hook":
      return "70% of base 1% → hook pot";
    default:
      return moduleDetailLine(id, modules);
  }
}

function ActionHint({ id, live }: { id: MasterHookId; live: LiveBits }) {
  if (id === "holder-airdrop") {
    const ready = live.airdropSecondsLeft != null && live.airdropSecondsLeft <= 0;
    return (
      <p className="token-hooks-action">
        {ready
          ? "Window open — next swap can push the pot pro-rata to holders."
          : "Fees accrue here. When Ready, a swap on this token can distribute the pot."}
      </p>
    );
  }
  if (id === "backed-floor") {
    return (
      <p className="token-hooks-action">
        Redeem launch tokens for quote at P_floor via the Floor vault card below.
      </p>
    );
  }
  return null;
}

export function ActiveHooksPanel({ pool }: { pool: TokenPool }) {
  const factory = getLaunchFactoryAddress();
  const isMaster = pool.rail === "master" && pool.hookType === "Master" && !pool.hooks.customHook;
  const resolved = useMemo(() => (isMaster ? resolveModules(pool) : null), [isMaster, pool]);

  const token = pool.contractAddress as Address | undefined;
  const quote = (pool.quoteAddress ?? zeroAddress) as Address;
  const quoteLabel = poolQuoteLabel(pool);
  const decimals = quoteDecimals(quote);

  const { data: masterHook } = useReadContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "masterHook",
    query: { enabled: !!factory && isMaster },
  });

  const needFloor = Boolean(resolved?.modules.backedFloor);
  const needAirdrop = Boolean(resolved?.modules.holderAirdrop);
  const needBurn = Boolean(resolved?.modules.autoBurn);

  const { data: floorVault } = useReadContract({
    address: masterHook,
    abi: masterLaunchHookAbi,
    functionName: "floorVault",
    query: { enabled: !!masterHook && needFloor },
  });

  const { data: airdropVault } = useReadContract({
    address: masterHook,
    abi: masterLaunchHookAbi,
    functionName: "holderAirdropVault",
    query: { enabled: !!masterHook && needAirdrop },
  });

  const { data: floorPriceX18 } = useReadContract({
    address: floorVault as Address | undefined,
    abi: floorVaultAbi,
    functionName: "floorPriceX18",
    args: token ? [token] : undefined,
    query: { enabled: !!floorVault && !!token && needFloor, refetchInterval: 15_000 },
  });

  const { data: floorReserve } = useReadContract({
    address: floorVault as Address | undefined,
    abi: floorVaultAbi,
    functionName: "reserve",
    args: token ? [token] : undefined,
    query: { enabled: !!floorVault && !!token && needFloor, refetchInterval: 15_000 },
  });

  const { data: airdropReserve } = useReadContract({
    address: airdropVault as Address | undefined,
    abi: holderAirdropVaultAbi,
    functionName: "reserve",
    args: token ? [token] : undefined,
    query: { enabled: !!airdropVault && !!token && needAirdrop, refetchInterval: 12_000 },
  });

  const { data: airdropSeconds } = useReadContract({
    address: airdropVault as Address | undefined,
    abi: holderAirdropVaultAbi,
    functionName: "secondsUntilAirdrop",
    args: token ? [token] : undefined,
    query: { enabled: !!airdropVault && !!token && needAirdrop, refetchInterval: 5_000 },
  });

  const { data: totalSupply } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "totalSupply",
    query: { enabled: !!token && needBurn, refetchInterval: 20_000 },
  });

  if (!isMaster || !resolved) return null;

  const { modules, hookTaxBps } = resolved;
  const enabledHooks = MASTER_HOOKS.filter((hook) => isModuleEnabled(modules, hook.id));
  if (enabledHooks.length === 0 && hookTaxBps <= 0) return null;

  const burnedPct =
    totalSupply !== undefined && LAUNCH_SUPPLY_WEI > 0n
      ? Math.max(
          0,
          Math.min(
            100,
            Number(((LAUNCH_SUPPLY_WEI - (totalSupply as bigint)) * 10_000n) / LAUNCH_SUPPLY_WEI) /
              100,
          ),
        )
      : null;

  const live: LiveBits = {
    floorPriceHuman:
      floorPriceX18 !== undefined ? Number(formatUnits(floorPriceX18 as bigint, 18)) : null,
    floorReserveHuman:
      floorReserve !== undefined ? Number(formatUnits(floorReserve as bigint, decimals)) : null,
    airdropPendingHuman:
      airdropReserve !== undefined
        ? Number(formatUnits(airdropReserve as bigint, decimals))
        : null,
    airdropSecondsLeft: airdropSeconds !== undefined ? Number(airdropSeconds) : null,
    burnedPct,
    quoteLabel,
  };

  return (
    <section className="token-hooks-panel desk-card">
      <header className="token-hooks-head">
        <div>
          <p className="token-hooks-kicker">Active hooks</p>
          <h2 className="token-hooks-title">Master modules</h2>
        </div>
        <div className="token-hooks-fee">
          <span>{totalFeeSummary(hookTaxBps)}</span>
          <span className="token-hooks-fee-sub">{hookTaxSummary(hookTaxBps)}</span>
        </div>
      </header>

      <ul className="token-hooks-list">
        {enabledHooks.map((hook) => {
          const status = liveStatusForHook(hook.id, modules, pool, live);
          return (
            <li key={hook.id} className={cn("token-hooks-row", `token-hooks-row--${hook.theme}`)}>
              <div className="token-hooks-row-main">
                <span
                  className={cn(
                    "token-hooks-chip orb-hook-desc-badge",
                    `orb-hook-desc-badge--${hook.theme}`,
                  )}
                >
                  <MasterHookAsciiIcon hookId={hook.id} className="token-hooks-ascii" />
                  <span>{hook.title}</span>
                </span>
                <span
                  className={cn(
                    "token-hooks-detail orb-hook-desc-badge",
                    `orb-hook-desc-badge--${hook.theme}`,
                  )}
                >
                  {moduleDetailLine(hook.id, modules)}
                </span>
              </div>
              {status ? <p className="token-hooks-live">{status}</p> : null}
              <ActionHint id={hook.id} live={live} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
