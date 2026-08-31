"use client";

import { useMemo, type ReactNode } from "react";
import { formatUnits, zeroAddress, type Address } from "viem";
import { useReadContract } from "wagmi";

import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { MasterHookAsciiIcon } from "@/components/home/market/MasterHookAsciiIcon";
import { HookInlineAction } from "@/components/token/HookInlineActions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { unpackLaunchBitmask } from "@/lib/bitmask";
import { buybackVaultAbi } from "@/lib/contracts/buyback-vault-abi";
import { getLaunchFactoryAddress, STABLE_QUOTE_ADDRESS } from "@/lib/contracts/config";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { holderAirdropVaultAbi } from "@/lib/contracts/holder-airdrop-vault-abi";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { masterLaunchHookAbi } from "@/lib/contracts/master-launch-hook-abi";
import { floorVaultAbi } from "@/lib/contracts/swap-abi";
import {
  buildModulesSummarySentence,
  isModuleEnabled,
  moduleTooltipText,
} from "@/lib/launch-module-summary";
import { MASTER_HOOKS, type HookTheme, type MasterHookId } from "@/lib/master-hooks";
import {
  moduleLiveStatLine,
  moduleMeterPct,
  type ModuleLiveStats,
} from "@/lib/module-live-stats";
import { poolQuoteLabel } from "@/lib/payment-assets";
import { TOTAL_SUPPLY } from "@/lib/token-live";
import type { LaunchModules, TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

const LAUNCH_SUPPLY_WEI = BigInt(TOTAL_SUPPLY) * 10n ** 18n;

function ModuleTip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        showArrow={false}
        className="max-w-[260px] border border-border bg-popover px-2.5 py-1.5 text-left text-[11px] leading-snug text-popover-foreground shadow-lg"
      >
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

function quoteDecimals(quote: Address): number {
  if (quote === zeroAddress) return 18;
  if (quote.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase()) return 6;
  return 18;
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

function ModuleMeter({
  label,
  pct,
  theme,
}: {
  label: string;
  pct: number;
  theme: HookTheme;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="token-hooks-meter">
      <div className="token-hooks-meter-head">
        <span className="token-hooks-meter-label">{label}</span>
        <span className="token-hooks-meter-value">{Math.round(clamped)}%</span>
      </div>
      <div className="token-hooks-meter-track" aria-hidden>
        <span
          className={cn("token-hooks-meter-fill", `token-hooks-meter-fill--${theme}`)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function ActiveHooksPanel({ pool }: { pool: TokenPool }) {
  const factory = getLaunchFactoryAddress();
  const isMaster = pool.rail === "master" && pool.hookType === "Master" && !pool.hooks.customHook;
  const resolved = useMemo(() => (isMaster ? resolveModules(pool) : null), [isMaster, pool]);

  const token = pool.contractAddress as Address | undefined;
  const creator = pool.creator as Address | undefined;
  const poolId = pool.poolId;
  const quote = (pool.quoteAddress ?? zeroAddress) as Address;
  const quoteLabel = poolQuoteLabel(pool);
  const decimals = quoteDecimals(quote);

  const { data: masterHook } = useReadContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "masterHook",
    query: { enabled: !!factory && isMaster },
  });

  const modules = resolved?.modules;
  const needFloor = Boolean(modules?.backedFloor);
  const needAirdrop = Boolean(modules?.holderAirdrop);
  const needBurn = Boolean(modules?.autoBurn);
  const needBuyback = Boolean(modules?.buybackVesting);
  const needLpDonate = Boolean(modules?.lpDonate);

  const { data: buybackVaultAddr } = useReadContract({
    address: masterHook,
    abi: masterLaunchHookAbi,
    functionName: "buybackVault",
    query: { enabled: !!masterHook && needBuyback },
  });

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

  const { data: pendingLpDonateWei } = useReadContract({
    address: masterHook,
    abi: masterLaunchHookAbi,
    functionName: "pendingLpDonate",
    args: poolId ? [poolId] : undefined,
    query: { enabled: !!masterHook && !!poolId && needLpDonate, refetchInterval: 15_000 },
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

  const { data: airdropLastAt } = useReadContract({
    address: airdropVault as Address | undefined,
    abi: holderAirdropVaultAbi,
    functionName: "lastAirdropAt",
    args: token ? [token] : undefined,
    query: { enabled: !!airdropVault && !!token && needAirdrop, refetchInterval: 30_000 },
  });

  const { data: buybackStream } = useReadContract({
    address: buybackVaultAddr as Address | undefined,
    abi: buybackVaultAbi,
    functionName: "streams",
    args: creator && token ? [creator, token] : undefined,
    query: { enabled: !!buybackVaultAddr && !!creator && !!token && needBuyback, refetchInterval: 20_000 },
  });

  const { data: buybackClaimableWei } = useReadContract({
    address: buybackVaultAddr as Address | undefined,
    abi: buybackVaultAbi,
    functionName: "vestedOf",
    args: creator && token ? [creator, token] : undefined,
    query: { enabled: !!buybackVaultAddr && !!creator && !!token && needBuyback, refetchInterval: 20_000 },
  });

  const { data: totalSupply } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "totalSupply",
    query: { enabled: !!token && needBurn, refetchInterval: 20_000 },
  });

  if (!isMaster || !resolved) return null;

  const { modules: resolvedModules, hookTaxBps } = resolved;
  const enabledHooks = MASTER_HOOKS.filter((hook) => isModuleEnabled(resolvedModules, hook.id));
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

  let buybackTotalHuman: number | null = null;
  let buybackClaimedHuman: number | null = null;
  let buybackClaimableHuman: number | null = null;
  let buybackVestSecondsLeft: number | null = null;

  if (buybackStream) {
    const amount = buybackStream[1] as bigint;
    const start = Number(buybackStream[2]);
    const claimed = buybackStream[3] as bigint;
    const durationSec =
      Number(buybackStream[4]) ||
      (resolvedModules.buybackVestingDurationDays ?? 365 * 5) * 86_400;
    buybackTotalHuman = Number(formatUnits(amount, decimals));
    buybackClaimedHuman = Number(formatUnits(claimed, decimals));
    buybackClaimableHuman =
      buybackClaimableWei !== undefined
        ? Number(formatUnits(buybackClaimableWei as bigint, decimals))
        : null;
    if (start > 0) {
      buybackVestSecondsLeft = Math.max(0, start + durationSec - Math.floor(Date.now() / 1000));
    }
  }

  const live: ModuleLiveStats = {
    floorPriceHuman:
      floorPriceX18 !== undefined ? Number(formatUnits(floorPriceX18 as bigint, 18)) : null,
    floorReserveHuman:
      floorReserve !== undefined ? Number(formatUnits(floorReserve as bigint, decimals)) : null,
    airdropPendingHuman:
      airdropReserve !== undefined
        ? Number(formatUnits(airdropReserve as bigint, decimals))
        : null,
    airdropSecondsLeft: airdropSeconds !== undefined ? Number(airdropSeconds) : null,
    airdropLastAtSec: airdropLastAt !== undefined ? Number(airdropLastAt) : null,
    burnedPct,
    lpDonatePendingHuman:
      pendingLpDonateWei !== undefined
        ? Number(formatUnits(pendingLpDonateWei as bigint, decimals))
        : null,
    buybackTotalHuman,
    buybackClaimableHuman,
    buybackClaimedHuman,
    buybackVestSecondsLeft,
    quoteLabel,
  };

  const floorReserveWei = (floorReserve as bigint | undefined) ?? BigInt(0);
  const summary = buildModulesSummarySentence(enabledHooks.map((h) => h.id));

  return (
    <section className="token-hooks-panel desk-card">
      <header className="token-hooks-head">
        <span className="token-type-badge token-type-badge--master token-hooks-master-badge">
          <MasterHookGlyph className="token-type-badge-glyph" />
          Master modules
        </span>
        <span className="token-hooks-count">
          {enabledHooks.length} module{enabledHooks.length === 1 ? "" : "s"}
        </span>
      </header>

      {summary ? (
        <p className="token-type-badge token-type-badge--master token-hooks-summary-badge">
          <MasterHookGlyph className="token-type-badge-glyph shrink-0" />
          <span>{summary}</span>
        </p>
      ) : null}

      <ul className="token-hooks-list">
        {enabledHooks.map((hook) => {
          const stat = moduleLiveStatLine(hook.id, resolvedModules, live, pool, hookTaxBps);
          const meterPct = moduleMeterPct(hook.id, resolvedModules, pool, live);
          return (
            <li key={hook.id} className={cn("token-hooks-row", `token-hooks-row--${hook.theme}`)}>
              <ModuleTip tip={moduleTooltipText(hook.description, hook.id, resolvedModules)}>
                <span
                  className={cn(
                    "token-hooks-chip orb-hook-desc-badge",
                    `orb-hook-desc-badge--${hook.theme}`,
                  )}
                >
                  <MasterHookAsciiIcon hookId={hook.id} className="token-hooks-ascii" />
                  <span>{hook.title}</span>
                </span>
              </ModuleTip>
              {stat ? <p className="token-hooks-live">{stat}</p> : null}
              {meterPct != null ? (
                <ModuleMeter label={hook.title} pct={meterPct} theme={hook.theme} />
              ) : null}
              <HookInlineAction
                id={hook.id}
                pool={pool}
                floorVault={floorVault as Address | undefined}
                floorReserveWei={floorReserveWei}
                decimals={decimals}
                floorPriceHuman={live.floorPriceHuman}
                quoteLabel={live.quoteLabel}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
