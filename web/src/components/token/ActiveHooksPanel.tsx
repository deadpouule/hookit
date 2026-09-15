"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatUnits, zeroAddress, type Address } from "viem";
import { usePublicClient, useReadContract } from "wagmi";

import { useNowSeconds } from "@/hooks/useNowSeconds";

import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { MasterHookAsciiIcon } from "@/components/home/market/MasterHookAsciiIcon";
import { HookInlineAction } from "@/components/token/HookInlineActions";
import { PoolQuoteMark } from "@/components/token/PoolQuoteMark";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buybackVaultAbi } from "@/lib/contracts/buyback-vault-abi";
import { STABLE_QUOTE_ADDRESS } from "@/lib/contracts/config";
import { quoteToCurrencyId } from "@/lib/currency-id";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { holderAirdropVaultAbi } from "@/lib/contracts/holder-airdrop-vault-abi";
import { masterLaunchHookAbi } from "@/lib/contracts/master-launch-hook-abi";
import { floorVaultAbi } from "@/lib/contracts/swap-abi";
import {
  enabledMasterHooksInOrder,
  moduleTooltipText,
  resolveTokenModules,
} from "@/lib/launch-module-summary";
import { FIXED_FEE_HOOK, type BrowseHookId, type MasterHookId } from "@/lib/master-hooks";
import { fetchDeepenLpsAdded } from "@/lib/deepen-lps-added";
import { buybackClaimableWei as computeBuybackClaimableWei, moduleLiveStatLine, type ModuleLiveStats } from "@/lib/module-live-stats";
import { quotePerTokenFromSqrtPrice, STATE_VIEW_ADDRESS, stateViewAbi } from "@/lib/pool-price";
import { hookTaxSummary, totalFeePlain } from "@/lib/launch-module-summary";
import { poolQuoteLabel } from "@/lib/payment-assets";
import { TOTAL_SUPPLY } from "@/lib/token-live";
import type { LaunchModules, TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

const LAUNCH_SUPPLY_WEI = BigInt(TOTAL_SUPPLY) * 10n ** 18n;

function ModuleTip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="w-full min-w-0 cursor-help">{children}</div>
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
  return resolveTokenModules(pool);
}

const EXPANDED_HOOK_IDS = new Set<MasterHookId>([
  "backed-floor",
  "holder-airdrop",
]);

function withQuoteMark(stat: string, quoteLabel: string, mark: ReactNode): ReactNode {
  const i = stat.indexOf(quoteLabel);
  if (i < 0) return stat;
  return (
    <>
      {stat.slice(0, i)}
      <span className="token-hooks-quote-mark">{mark}</span>
      {stat.slice(i)}
    </>
  );
}

function HookModuleBadge({
  hook,
  stat,
  tip,
  mark,
  quoteLabel,
  children,
}: {
  hook: { id: string; title: string; theme: string };
  stat: string | null;
  tip: string;
  mark?: ReactNode;
  quoteLabel?: string;
  children?: ReactNode;
}) {
  const stacked = Boolean(children);

  return (
    <div
      className={cn(
        "token-hooks-chip",
        stacked && "token-hooks-chip--expanded",
      )}
    >
      <ModuleTip tip={tip}>
        <div className="token-hooks-chip-top">
          <MasterHookAsciiIcon
            hookId={hook.id as BrowseHookId}
            className="token-hooks-ascii"
          />
          <span className="token-hooks-chip-copy">
            <span className="token-hooks-chip-title">{hook.title}</span>
            {stat ? (
              <>
                <span className="token-hooks-chip-sep" aria-hidden>
                  ·
                </span>
                <span className="token-hooks-chip-stat token-hooks-chip-stat--live">
                  {mark && quoteLabel
                    ? withQuoteMark(stat, quoteLabel, mark)
                    : stat}
                </span>
              </>
            ) : null}
          </span>
        </div>
      </ModuleTip>
      {children}
    </div>
  );
}

export function ActiveHooksPanel({ pool }: { pool: TokenPool }) {
  const masterHook = pool.hooksAddress as Address | undefined;
  const isMaster = pool.rail === "master" && pool.hookType === "Master" && !pool.hooks.customHook;
  const resolved = useMemo(() => (isMaster ? resolveModules(pool) : null), [isMaster, pool]);

  const token = pool.contractAddress as Address | undefined;
  const creator = pool.creator as Address | undefined;
  const poolId = pool.poolId;
  const quote = (pool.quoteAddress ?? zeroAddress) as Address;
  const quoteLabel = poolQuoteLabel(pool);
  const decimals = quoteDecimals(quote);
  const quoteId = quoteToCurrencyId(quote);


  const modules = resolved?.modules;
  const needFloor = Boolean(modules?.backedFloor);
  const needAirdrop = Boolean(modules?.holderAirdrop);
  const needBurn = Boolean(modules?.autoBurn);
  const needBuyback = Boolean(modules?.buybackVesting);
  const needDeepenLps = Boolean(modules?.deepenLps);

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

  const { data: pendingDeepenLpsWei } = useReadContract({
    address: masterHook,
    abi: masterLaunchHookAbi,
    functionName: "pendingDeepenLps",
    args: poolId ? [poolId] : undefined,
    query: { enabled: !!masterHook && !!poolId && needDeepenLps, refetchInterval: 15_000 },
  });

  const publicClient = usePublicClient();
  const [deepenLpsAddedHuman, setDeepenLpsAddedHuman] = useState<number | null>(null);
  useEffect(() => {
    if (!publicClient || !masterHook || !poolId || !needDeepenLps) {
      setDeepenLpsAddedHuman(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      fetchDeepenLpsAdded(publicClient, masterHook, poolId, pool.launchedAt)
        .then((wei) => {
          if (!cancelled) setDeepenLpsAddedHuman(Number(formatUnits(wei, decimals)));
        })
        .catch(() => {
          if (!cancelled) setDeepenLpsAddedHuman(null);
        });
    };
    load();
    const id = window.setInterval(load, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [publicClient, masterHook, poolId, needDeepenLps, pool.launchedAt, decimals]);

  const { data: floorPriceX18 } = useReadContract({
    address: floorVault as Address | undefined,
    abi: floorVaultAbi,
    functionName: "floorPriceX18",
    args: token ? [token] : undefined,
    query: { enabled: !!floorVault && !!token && needFloor, refetchInterval: 15_000 },
  });

  const { data: floorSlot0 } = useReadContract({
    address: STATE_VIEW_ADDRESS,
    abi: stateViewAbi,
    functionName: "getSlot0",
    args: poolId ? [poolId] : undefined,
    query: { enabled: !!poolId && needFloor, refetchInterval: 12_000 },
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
    functionName: "potOf",
    args: token && quote ? [token, quote] : undefined,
    query: { enabled: !!airdropVault && !!token && !!quote && needAirdrop, refetchInterval: 12_000 },
  });

  const { data: airdropSeconds } = useReadContract({
    address: airdropVault as Address | undefined,
    abi: holderAirdropVaultAbi,
    functionName: "secondsUntilAirdrop",
    args: token && quote ? [token, quote] : undefined,
    query: { enabled: !!airdropVault && !!token && !!quote && needAirdrop, refetchInterval: 5_000 },
  });

  const { data: airdropLastAt } = useReadContract({
    address: airdropVault as Address | undefined,
    abi: holderAirdropVaultAbi,
    functionName: "lastAirdropAt",
    args: token ? [token] : undefined,
    query: { enabled: !!airdropVault && !!token && needAirdrop, refetchInterval: 30_000 },
  });

  const { data: airdropEpochSec } = useReadContract({
    address: airdropVault as Address | undefined,
    abi: holderAirdropVaultAbi,
    functionName: "epochSeconds",
    args: token ? [token] : undefined,
    query: { enabled: !!airdropVault && !!token && needAirdrop },
  });

  const { data: airdropReleasedWei } = useReadContract({
    address: airdropVault as Address | undefined,
    abi: holderAirdropVaultAbi,
    functionName: "released",
    args: token ? [token, quoteId] : undefined,
    query: { enabled: !!airdropVault && !!token && needAirdrop, refetchInterval: 15_000 },
  });

  const { data: airdropHighWaterFdv } = useReadContract({
    address: airdropVault as Address | undefined,
    abi: holderAirdropVaultAbi,
    functionName: "highWaterFdvUsd",
    args: token ? [token] : undefined,
    query: {
      enabled: !!airdropVault && !!token && needAirdrop && (modules?.holderAirdropMcapUsd ?? 0) > 0,
      refetchInterval: 20_000,
    },
  });

  const vestNowSec = useNowSeconds(needBuyback);

  const { data: buybackStream, refetch: refetchBuybackStream } = useReadContract({
    address: buybackVaultAddr as Address | undefined,
    abi: buybackVaultAbi,
    functionName: "streams",
    args: creator && token ? [creator, token] : undefined,
    query: { enabled: !!buybackVaultAddr && !!creator && !!token && needBuyback, refetchInterval: 15_000 },
  });

  const { data: buybackVestedWei } = useReadContract({
    address: buybackVaultAddr as Address | undefined,
    abi: buybackVaultAbi,
    functionName: "vestedOf",
    args: creator && token ? [creator, token] : undefined,
    query: { enabled: !!buybackVaultAddr && !!creator && !!token && needBuyback, refetchInterval: 15_000 },
  });

  const { data: buybackHighWaterFdv } = useReadContract({
    address: buybackVaultAddr as Address | undefined,
    abi: buybackVaultAbi,
    functionName: "highWaterFdvUsd",
    args: token ? [token] : undefined,
    query: {
      enabled: !!buybackVaultAddr && !!token && needBuyback && (modules?.buybackVestingMcapUsd ?? 0) > 0,
      refetchInterval: 20_000,
    },
  });

  const { data: totalSupply } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "totalSupply",
    query: { enabled: !!token && needBurn, refetchInterval: 20_000 },
  });

  if (!isMaster || !resolved) return null;

  const { modules: resolvedModules, hookTaxBps } = resolved;
  const enabledHooks = enabledMasterHooksInOrder(resolvedModules);
  const showFixedFee = hookTaxBps > 0 && !resolvedModules.dynamicFees;
  if (enabledHooks.length === 0 && !showFixedFee) return null;

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
  let liveBuybackClaimableWei = 0n;
  const fallbackDuration =
    (resolvedModules.buybackVestingDurationDays ?? 365 * 5) * 86_400;
  const launchStart =
    pool.launchedAt && pool.launchedAt > 1_000_000_000 ? pool.launchedAt : vestNowSec;

  if (buybackStream) {
    const amount = buybackStream[1] as bigint;
    const start = Number(buybackStream[2]);
    const claimed = buybackStream[3] as bigint;
    const durationSec = Number(buybackStream[4]) || fallbackDuration;
    liveBuybackClaimableWei = computeBuybackClaimableWei({
      amount,
      startSec: start,
      claimed,
      durationSec,
      nowSec: vestNowSec,
    });
    if (buybackVestedWei !== undefined) {
      liveBuybackClaimableWei = buybackVestedWei as bigint;
    }
    buybackTotalHuman = Number(formatUnits(amount, decimals));
    buybackClaimedHuman = Number(formatUnits(claimed, decimals));
    buybackClaimableHuman = Number(formatUnits(liveBuybackClaimableWei, decimals));
    const vestStart = start > 0 ? start : launchStart;
    buybackVestSecondsLeft = Math.max(0, vestStart + durationSec - vestNowSec);
  } else if (needBuyback) {
    buybackVestSecondsLeft = Math.max(0, launchStart + fallbackDuration - vestNowSec);
    buybackClaimableHuman = 0;
  }

  const slotSqrt =
    floorSlot0 !== undefined
      ? (floorSlot0 as readonly [bigint, number, number, number])[0]
      : undefined;
  const liveSpot =
    slotSqrt !== undefined
      ? quotePerTokenFromSqrtPrice(slotSqrt, pool.tokenIsCurrency0 ?? false, 18, decimals)
      : null;
  const fallbackSpot = pool.priceEth && pool.priceEth > 0 ? pool.priceEth : null;
  const spotPriceHuman = liveSpot && liveSpot > 0 ? liveSpot : fallbackSpot;

  const live: ModuleLiveStats = {
    floorPriceHuman:
      floorPriceX18 !== undefined ? Number(formatUnits(floorPriceX18 as bigint, 18)) : null,
    spotPriceHuman,
    floorReserveHuman:
      floorReserve !== undefined ? Number(formatUnits(floorReserve as bigint, decimals)) : null,
    airdropPendingHuman:
      airdropReserve !== undefined
        ? Number(formatUnits(airdropReserve as bigint, decimals))
        : null,
    airdropReleasedHuman:
      airdropReleasedWei !== undefined
        ? Number(formatUnits(airdropReleasedWei as bigint, decimals))
        : null,
    airdropSecondsLeft: airdropSeconds !== undefined ? Number(airdropSeconds) : null,
    airdropLastAtSec: airdropLastAt !== undefined ? Number(airdropLastAt) : null,
    airdropEpochSec: airdropEpochSec !== undefined ? Number(airdropEpochSec) : null,
    airdropHighWaterFdvUsd:
      airdropHighWaterFdv !== undefined ? Number(airdropHighWaterFdv as bigint) : null,
    burnedPct,
    deepenLpsPendingHuman:
      pendingDeepenLpsWei !== undefined
        ? Number(formatUnits(pendingDeepenLpsWei as bigint, decimals))
        : null,
    deepenLpsAddedHuman,
    buybackTotalHuman,
    buybackClaimableHuman,
    buybackClaimedHuman,
    buybackClaimableWei: liveBuybackClaimableWei,
    buybackQuoteDecimals: decimals,
    buybackVestSecondsLeft,
    buybackHighWaterFdvUsd:
      buybackHighWaterFdv !== undefined ? Number(buybackHighWaterFdv as bigint) : null,
    quoteLabel,
  };

  const floorReserveWei = (floorReserve as bigint | undefined) ?? BigInt(0);
  const moduleCount = enabledHooks.length + (showFixedFee ? 1 : 0);

  return (
    <section className="token-hooks-panel desk-card">
      <header className="token-hooks-head">
        <span className="token-type-badge token-type-badge--master token-hooks-count-badge">
          <MasterHookGlyph className="token-type-badge-glyph" />
          {moduleCount} master module{moduleCount === 1 ? "" : "s"}
        </span>
      </header>

      <ul className="token-hooks-list" data-count={moduleCount}>
        {enabledHooks.map((hook) => {
          const stat = moduleLiveStatLine(hook.id, resolvedModules, live, pool, hookTaxBps);
          const tip = moduleTooltipText(hook.description, hook.id, resolvedModules, hookTaxBps);
          const expanded = EXPANDED_HOOK_IDS.has(hook.id);

          return (
            <li key={hook.id} className={cn("token-hooks-row", `token-hooks-row--${hook.theme}`)}>
              <HookModuleBadge
                hook={hook}
                stat={stat}
                tip={tip}
                quoteLabel={live.quoteLabel}
                mark={
                  hook.id === "holder-airdrop" || hook.id === "deepen-lps" || hook.id === "buyback-vesting" ? (
                    <PoolQuoteMark quoteAddress={pool.quoteAddress} quoteAsset={pool.quoteAsset} />
                  ) : undefined
                }
              >
                {expanded && hook.id !== "buyback-vesting" ? (
                  <HookInlineAction
                    id={hook.id}
                    pool={pool}
                    floorVault={floorVault as Address | undefined}
                    floorReserveWei={floorReserveWei}
                    airdropVault={airdropVault as Address | undefined}
                    airdropReserveWei={(airdropReserve as bigint | undefined) ?? BigInt(0)}
                    airdropSecondsLeft={live.airdropSecondsLeft}
                    buybackVault={buybackVaultAddr as Address | undefined}
                    buybackClaimableWei={liveBuybackClaimableWei}
                    buybackVestSecondsLeft={live.buybackVestSecondsLeft}
                    decimals={decimals}
                    floorPriceHuman={live.floorPriceHuman}
                    quoteLabel={live.quoteLabel}
                    embedded
                    theme={hook.theme}
                  />
                ) : null}
                {hook.id === "buyback-vesting" ? (
                  <HookInlineAction
                    id={hook.id}
                    pool={pool}
                    floorVault={floorVault as Address | undefined}
                    floorReserveWei={floorReserveWei}
                    airdropVault={airdropVault as Address | undefined}
                    airdropReserveWei={(airdropReserve as bigint | undefined) ?? BigInt(0)}
                    airdropSecondsLeft={live.airdropSecondsLeft}
                    buybackVault={buybackVaultAddr as Address | undefined}
                    buybackClaimableWei={liveBuybackClaimableWei}
                    buybackVestSecondsLeft={live.buybackVestSecondsLeft}
                    decimals={decimals}
                    floorPriceHuman={live.floorPriceHuman}
                    quoteLabel={live.quoteLabel}
                    onBuybackClaimed={() => {
                      void refetchBuybackStream();
                    }}
                    embedded
                    theme={hook.theme}
                  />
                ) : null}
              </HookModuleBadge>
            </li>
          );
        })}
        {showFixedFee ? (
          <li className={cn("token-hooks-row", `token-hooks-row--${FIXED_FEE_HOOK.theme}`)}>
            <HookModuleBadge
              hook={FIXED_FEE_HOOK}
              stat={totalFeePlain(hookTaxBps)}
              tip={hookTaxSummary(hookTaxBps)}
            />
          </li>
        ) : null}
      </ul>
    </section>
  );
}
