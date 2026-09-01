"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Copy, ExternalLink, Flame } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { TokenTypeBadges } from "@/components/home/market/TokenBadges";
import { ActiveHooksPanel } from "@/components/token/ActiveHooksPanel";
import { BondingProgress } from "@/components/token/BondingProgress";
import { CreatorActions } from "@/components/token/CreatorActions";
import { TokenCandleChart, type ChartInterval } from "@/components/token/TokenCandleChart";
import { TokenSidebarStats } from "@/components/token/TokenSidebarStats";
import { TokenTxTable } from "@/components/token/TokenTxTable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLiveToken } from "@/hooks/useLiveToken";
import { copyToClipboard } from "@/lib/clipboard";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts/config";
import { isModuleEnabled, resolveTokenModules } from "@/lib/launch-module-summary";
import { formatAge, formatCompactUsd, isValidLaunchTimestamp } from "@/lib/format";
import { MASTER_HOOKS } from "@/lib/master-hooks";
import { poolToMarketToken } from "@/lib/market-tokens";
import { resolveMediaUrl } from "@/lib/token-metadata";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

const TokenSwapCard = dynamic(
  () => import("@/components/token/TokenSwapCard").then((m) => m.TokenSwapCard),
  {
    loading: () => (
      <div className="swap-card min-h-[280px] animate-pulse rounded-2xl bg-zinc-900/50" aria-hidden />
    ),
    ssr: false,
  },
);

function HeaderTip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        showArrow={false}
        className="max-w-[240px] border border-border bg-popover px-2.5 py-1.5 text-left text-[11px] leading-snug text-popover-foreground shadow-lg"
      >
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

interface TokenDetailViewProps {
  pool: TokenPool;
  isOriginal?: boolean;
  isCopycat?: boolean;
}

export function TokenDetailView({ pool, isOriginal, isCopycat }: TokenDetailViewProps) {
  const live = useLiveToken(pool);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"swaps" | "holders">("swaps");
  const [interval, setInterval] = useState<ChartInterval>("5m");
  const contractAddress = pool.contractAddress ?? pool.address;
  const trending = live.change1h >= 0;
  const ageSeconds = isValidLaunchTimestamp(pool.launchedAt)
    ? Math.max(1, Math.floor(Date.now() / 1000 - pool.launchedAt))
    : null;
  const media = resolveMediaUrl(pool.image);
  const marketToken = useMemo(() => poolToMarketToken(pool), [pool]);
  const isClassicDesk = pool.rail === "classic";
  const activeHookCount = useMemo(() => {
    if (isClassicDesk) return 0;
    const resolved = resolveTokenModules(pool);
    if (!resolved) return 0;
    return MASTER_HOOKS.filter((hook) => isModuleEnabled(resolved.modules, hook.id)).length;
  }, [isClassicDesk, pool]);
  const balancedDesk = !isClassicDesk && activeHookCount > 0 && activeHookCount <= 3;

  const copyAddress = async () => {
    if (!(await copyToClipboard(contractAddress))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const heroCard = (
    <div className="desk-card token-hero-card">
      <header className="flex flex-wrap items-start gap-3.5 p-4 sm:gap-4 sm:p-5">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border sm:h-20 sm:w-20"
          style={{ background: pool.bannerGradient }}
        >
          {media ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-white/90 sm:text-4xl">{pool.ticker[0]}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {pool.name}
            </h1>
            <span className="font-mono text-base text-muted-foreground sm:text-lg">${pool.ticker}</span>
            {isCopycat && (
              <span className="token-copy-badge !static !top-auto !right-auto" title="Copycat launch — verify the contract address">
                COPY
              </span>
            )}
            {isOriginal && !isCopycat && (
              <span className="token-og-badge !static !top-auto !right-auto" title="Original launch — first token with this ticker">
                OG
              </span>
            )}
            <TokenTypeBadges token={{ ...marketToken, isOriginal, isCopycat }} />
            {pool.rail === "classic" && (
              <HeaderTip
                tip={
                  pool.bondingPhase === 0
                    ? "Still on the bonding curve — graduates to a Uniswap pool when the target is hit."
                    : "Bonding curve finished — now trading on a Uniswap v4 pool."
                }
              >
                <span className="rounded-full bg-[#9514d1]/20 px-2.5 py-0.5 text-[12px] font-medium text-[#d8b4fe]">
                  {pool.bondingPhase === 0 ? "Bonding" : "Graduated"}
                </span>
              </HeaderTip>
            )}
            {trending && (
              <HeaderTip tip="Price is up over the last hour.">
                <span className="inline-flex items-center gap-1 text-[13px] font-medium text-orange-400">
                  <Flame className="h-3.5 w-3.5" />
                  Trend
                </span>
              </HeaderTip>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyAddress}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition hover:text-foreground"
            >
              {pool.address}
              <Copy className="h-3 w-3" />
              {copied && <span className="text-[#10b981]">Copied</span>}
            </button>
            <a
              href={`${BLOCK_EXPLORER_URL}/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition hover:text-[#03b1ed]"
              aria-label="Explorer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {ageSeconds != null && (
              <span className="rounded-full bg-[#10b981]/15 px-2.5 py-0.5 text-[11px] font-medium text-[#10b981]">
                Born {formatAge(ageSeconds)} ago
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="token-hero-metrics grid grid-cols-2 gap-4 px-4 pb-4 sm:grid-cols-4 sm:px-5 sm:pb-5">
        <Metric label="Market Cap" value={formatCompactUsd(live.marketCap)} />
        <Metric label="Vol 24h" value={formatCompactUsd(live.volume24h)} />
        <Metric label="Liquidity" value={formatCompactUsd(live.liquidity)} />
        <Metric label="Holders" value={live.holders.toString()} />
      </div>
    </div>
  );

  const chart = (
    <TokenCandleChart
      className={cn(
        "token-desk-chart",
        balancedDesk && "token-candle-chart--bleed",
      )}
      candles={live.candles}
      interval={interval}
      onInterval={setInterval}
      marketCap={live.marketCap}
      change24h={live.change24h}
      expanded={balancedDesk}
    />
  );

  const txTable = (
    <TokenTxTable
      className={cn(
        "token-desk-table",
        balancedDesk && "token-desk-table--bleed",
      )}
      tab={tab}
      onTab={setTab}
      swaps={live.swaps}
      holders={live.holderRows}
      ticker={pool.ticker}
    />
  );

  const rightRail = (
    <aside className="token-desk-rail token-desk-rail--right">
      <div className="token-desk-swap-stack">
        <TokenSwapCard pool={pool} />
        {isClassicDesk && <BondingProgress pool={pool} />}
        <CreatorActions pool={pool} />
        <TokenSidebarStats live={live} pool={pool} contractAddress={contractAddress} />
      </div>
    </aside>
  );

  return (
    <div className="market-shell token-detail-shell bg-background py-4 pb-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to explore
      </Link>

      {isClassicDesk ? (
        <div className="token-desk token-desk--wide mt-4">
          <div className="token-desk-main min-w-0 space-y-4">
            {heroCard}
            {chart}
            {txTable}
          </div>
          {rightRail}
        </div>
      ) : balancedDesk ? (
        <div className={cn("token-desk mt-4", "token-desk--hooks", "token-desk--balanced")}>
          <aside className="token-desk-rail token-desk-rail--left">
            <ActiveHooksPanel pool={pool} />
          </aside>
          <div className="token-desk-hero min-w-0">{heroCard}</div>
          {chart}
          {txTable}
          {rightRail}
        </div>
      ) : (
        <div className={cn("token-desk mt-4", "token-desk--hooks")}>
          <aside className="token-desk-rail token-desk-rail--left">
            <ActiveHooksPanel pool={pool} />
          </aside>
          <div className="token-desk-main min-w-0 space-y-4">
            {heroCard}
            {chart}
            {txTable}
          </div>
          {rightRail}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg text-foreground sm:text-xl">{value}</p>
    </div>
  );
}
