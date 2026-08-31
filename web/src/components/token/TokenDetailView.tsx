"use client";

import Link from "next/link";
import { ArrowLeft, Copy, ExternalLink, Flame } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { TokenTypeBadges } from "@/components/home/market/TokenBadges";
import { ActiveHooksPanel } from "@/components/token/ActiveHooksPanel";
import { BondingProgress } from "@/components/token/BondingProgress";
import { CreatorActions } from "@/components/token/CreatorActions";
import { TokenCandleChart, type ChartInterval } from "@/components/token/TokenCandleChart";
import { TokenSidebarStats } from "@/components/token/TokenSidebarStats";
import { TokenSwapCard } from "@/components/token/TokenSwapCard";
import { TokenTxTable } from "@/components/token/TokenTxTable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLiveToken } from "@/hooks/useLiveToken";
import { copyToClipboard } from "@/lib/clipboard";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts/config";
import { formatAge, formatCompactUsd, isValidLaunchTimestamp } from "@/lib/format";
import { poolToMarketToken } from "@/lib/market-tokens";
import { resolveMediaUrl } from "@/lib/token-metadata";
import type { TokenPool } from "@/lib/types";

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

  const copyAddress = async () => {
    if (!(await copyToClipboard(contractAddress))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="market-shell bg-background py-4 pb-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to explore
      </Link>

      <div className="token-desk mt-4">
        <aside className="token-desk-rail token-desk-rail--left space-y-3">
          <ActiveHooksPanel pool={pool} />
          <BondingProgress pool={pool} />
        </aside>

        <div className="token-desk-main min-w-0 space-y-4">
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

          <TokenCandleChart
            candles={live.candles}
            interval={interval}
            onInterval={setInterval}
            marketCap={live.marketCap}
            change24h={live.change24h}
          />
          <TokenTxTable
            tab={tab}
            onTab={setTab}
            swaps={live.swaps}
            holders={live.holderRows}
            ticker={pool.ticker}
          />
        </div>

        <aside className="token-desk-rail token-desk-rail--right space-y-3">
          <TokenSwapCard pool={pool} />
          <CreatorActions pool={pool} />
          <TokenSidebarStats live={live} pool={pool} contractAddress={contractAddress} />
        </aside>
      </div>
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
