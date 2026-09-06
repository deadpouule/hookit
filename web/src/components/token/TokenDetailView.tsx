"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Copy, ExternalLink, Flame, Globe } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { TokenTypeBadges } from "@/components/home/market/TokenBadges";
import { ActiveHooksPanel } from "@/components/token/ActiveHooksPanel";
import { BondingProgress } from "@/components/token/BondingProgress";
import { CreatorActions } from "@/components/token/CreatorActions";
import { TokenCandleChart, type ChartInterval } from "@/components/token/TokenCandleChart";
import { TokenTxTable } from "@/components/token/TokenTxTable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLiveToken } from "@/hooks/useLiveToken";
import { copyToClipboard } from "@/lib/clipboard";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts/config";
import { formatAge, formatCompactUsd, isValidLaunchTimestamp } from "@/lib/format";
import { poolToMarketToken } from "@/lib/market-tokens";
import {
  isMultiPool,
  marketLegLabel,
  marketSharePct,
  poolMarkets,
  poolWithMarket,
} from "@/lib/pool-active-market";
import { rememberSwapHref, tokenHref } from "@/lib/routes";
import { resolveMediaUrl, tokenTwitterUrl, tokenWebsiteUrl } from "@/lib/token-metadata";
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

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-zinc-500">{label}</span>
      <span className="text-foreground">{value}</span>
    </span>
  );
}

function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

interface TokenDetailViewProps {
  pool: TokenPool;
  isOriginal?: boolean;
  isCopycat?: boolean;
}

export function TokenDetailView({ pool, isOriginal, isCopycat }: TokenDetailViewProps) {
  const [marketIndex, setMarketIndex] = useState(0);
  const activePool = useMemo(() => poolWithMarket(pool, marketIndex), [pool, marketIndex]);
  const live = useLiveToken(activePool);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"swaps" | "holders">("swaps");
  const [interval, setInterval] = useState<ChartInterval>("1h");
  const [buyPrefill, setBuyPrefill] = useState<string | null>(null);
  const swapRef = useRef<HTMLDivElement>(null);
  const contractAddress = pool.contractAddress ?? pool.address;
  const trending = live.change1h >= 0;
  const ageSeconds = isValidLaunchTimestamp(pool.launchedAt)
    ? Math.max(1, Math.floor(Date.now() / 1000 - pool.launchedAt))
    : null;
  const media = resolveMediaUrl(pool.image);
  const marketToken = useMemo(() => poolToMarketToken(pool), [pool]);
  const isClassicDesk = pool.rail === "classic";
  const multi = isMultiPool(pool);
  const markets = useMemo(() => poolMarkets(pool), [pool]);
  const marketLegs = useMemo(
    () =>
      markets.map((m) => ({
        label: marketLegLabel(m),
        share: marketSharePct(m),
        quoteAddress: m.quoteAddress,
        quoteAsset: m.quoteAsset,
      })),
    [markets],
  );
  const masterHookAddr = pool.hooksAddress;
  const description = pool.description?.trim() || undefined;
  const twitterUrl = tokenTwitterUrl(pool.twitter);
  const websiteUrl = tokenWebsiteUrl(pool.website);

  useEffect(() => {
    const id = pool.contractAddress ?? pool.id;
    if (id) rememberSwapHref(tokenHref(id));
  }, [pool.contractAddress, pool.id]);

  useEffect(() => {
    setMarketIndex(0);
    setBuyPrefill(null);
  }, [pool.id, pool.contractAddress]);

  const copyAddress = async () => {
    if (!(await copyToClipboard(contractAddress))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const beFirstBuy = () => {
    setBuyPrefill("0.01");
    swapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
            <TokenTypeBadges token={{ ...marketToken, isOriginal, isCopycat }} hideMaster />
            {pool.rail === "master" && !pool.hooks.customHook && (
              <HeaderTip tip="Trades through Hookit’s MasterLaunchHook — LP is locked, fees are quote-only.">
                <span className="token-type-badge token-type-badge--master">
                  <MasterHookGlyph className="token-type-badge-glyph" />
                  Master hook
                </span>
              </HeaderTip>
            )}
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
              aria-label="Token on explorer"
              title="Token contract"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {masterHookAddr && (
              <a
                href={`${BLOCK_EXPLORER_URL}/address/${masterHookAddr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-muted-foreground transition hover:text-[#d8b4fe]"
              >
                Hook
              </a>
            )}
            {ageSeconds != null && (
              <span className="rounded-full bg-[#10b981]/15 px-2.5 py-0.5 text-[11px] font-medium text-[#10b981]">
                Born {formatAge(ageSeconds)} ago
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="token-hero-about flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="min-w-0 flex-1 basis-[260px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">About</p>
          <p
            className={cn(
              "mt-1 max-w-[70ch] text-[13px] leading-snug",
              description ? "text-zinc-300" : "text-zinc-500",
            )}
          >
            {description ?? "No description yet."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground sm:gap-x-6">
          <HeroStat label="Market cap" value={formatCompactUsd(live.marketCap)} />
          <HeroStat label="Liquidity" value={formatCompactUsd(live.liquidity)} />
          <HeroStat label="24h volume" value={formatCompactUsd(live.volume24h)} />
          {(twitterUrl || websiteUrl) && (
            <span className="flex items-center gap-1.5">
              {twitterUrl && (
                <a
                  href={twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="token-hero-link"
                  aria-label="Token on X"
                  title="X"
                >
                  <XGlyph className="h-3.5 w-3.5" />
                </a>
              )}
              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="token-hero-link"
                  aria-label="Token website"
                  title="Website"
                >
                  <Globe className="h-4 w-4" strokeWidth={1.75} />
                </a>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="market-shell token-detail-shell bg-background py-4 pb-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to explore
      </Link>

      <div className={cn("token-desk mt-4", isClassicDesk ? "token-desk--wide" : "token-desk--hooks")}>
        {!isClassicDesk && (
          <>
            <div className="token-desk-hero min-w-0">{heroCard}</div>
            <aside className="token-desk-rail token-desk-rail--left space-y-3">
              <ActiveHooksPanel pool={pool} />
            </aside>
          </>
        )}

        <div className="token-desk-main min-w-0 space-y-4">
          {isClassicDesk && heroCard}

          {multi && (
            <p className="rounded-lg border border-[#9514d1]/25 bg-[#9514d1]/10 px-3 py-2 text-[12px] text-zinc-300">
              This token trades on <strong className="text-foreground">{markets.length} pools</strong>
              {" "}({marketLegs.map((l) => l.label).join(" + ")}). Supply is split across them — pick a
              pool tab on the chart or swap to trade that quote.
            </p>
          )}

          <TokenCandleChart
            candles={live.candles}
            interval={interval}
            onInterval={setInterval}
            marketCap={live.marketCap}
            change5m={live.change5m}
            change1h={live.change1h}
            change6h={live.change6h}
            change24h={live.change24h}
            marketLegs={multi ? marketLegs : undefined}
            activeMarketIndex={marketIndex}
            onMarketIndex={multi ? setMarketIndex : undefined}
            onBeFirstBuy={beFirstBuy}
          />
          <TokenTxTable
            tab={tab}
            onTab={setTab}
            swaps={live.swaps}
            holders={live.holderRows}
            ticker={pool.ticker}
            className="token-desk-tx"
          />
        </div>

        <aside className="token-desk-rail token-desk-rail--right space-y-3">
          <div ref={swapRef}>
            <TokenSwapCard
              pool={activePool}
              marketIndex={marketIndex}
              markets={multi ? markets : undefined}
              onMarketIndex={multi ? setMarketIndex : undefined}
              buyPrefill={buyPrefill}
              onBuyPrefillConsumed={() => setBuyPrefill(null)}
            />
          </div>
          {isClassicDesk && <BondingProgress pool={pool} />}
          <CreatorActions pool={activePool} />
        </aside>
      </div>
    </div>
  );
}
