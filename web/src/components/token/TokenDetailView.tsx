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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLiveToken } from "@/hooks/useLiveToken";
import { copyToClipboard } from "@/lib/clipboard";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts/config";
import { isPhoneDocument } from "@/lib/device";
import {
  formatAge,
  formatCompactUsd,
  formatPercent,
  isValidLaunchTimestamp,
  shortenAddress,
} from "@/lib/format";
import { poolToMarketToken } from "@/lib/market-tokens";
import {
  isMultiPool,
  marketLegLabel,
  marketSharePct,
  poolMarkets,
  poolWithMarket,
} from "@/lib/pool-active-market";
import { rememberSwapHref, tokenHref } from "@/lib/routes";
import { TOTAL_SUPPLY } from "@/lib/token-live";
import {
  resolveMediaUrl,
  tokenGithubUrl,
  tokenTwitterUrl,
  tokenWebsiteUrl,
} from "@/lib/token-metadata";
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

function formatPriceUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1) return formatCompactUsd(value);
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  if (value >= 0.0001) return `$${value.toFixed(6)}`;
  const exp = value.toExponential(2).replace("e+", "e").replace("e-0", "e-");
  return `$${exp}`;
}

function HeroStat({
  label,
  value,
  children,
  className,
  title,
}: {
  label: string;
  value: string;
  children?: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div className={cn("token-hero-stat", className)}>
      <dt className="token-hero-stat-label">{label}</dt>
      <dd className="token-hero-stat-value" title={title ?? value}>
        {value}
        {children}
      </dd>
    </div>
  );
}

function HeroLink({
  href,
  label,
  children,
}: {
  href?: string;
  label: string;
  children: ReactNode;
}) {
  if (!href) {
    return (
      <span
        className="token-hero-link token-hero-link--off"
        aria-label={`${label} not set`}
        title={`${label} — not set`}
        aria-disabled
      >
        {children}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="token-hero-link"
      aria-label={`Token ${label}`}
      title={label}
    >
      {children}
    </a>
  );
}

function GithubGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
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
  const [interval, setInterval] = useState<ChartInterval | null>(null);
  const chartInterval = interval ?? "15m";
  const [buyPrefill, setBuyPrefill] = useState<string | null>(null);
  const [swapSheetOpen, setSwapSheetOpen] = useState(false);
  const [swapSheetSide, setSwapSheetSide] = useState<"buy" | "sell">("buy");
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
  const githubUrl = tokenGithubUrl(pool.github);
  const ath = useMemo(
    () => live.candles.reduce((m, c) => Math.max(m, c.h), live.marketCap),
    [live.candles, live.marketCap],
  );
  const fullyDiluted = live.priceUsd * TOTAL_SUPPLY;
  // Only show FDV when burns / excluded sinks make it differ from market cap.
  const fdv =
    fullyDiluted > 0 && Math.abs(fullyDiluted - live.marketCap) / fullyDiluted > 0.005
      ? fullyDiluted
      : null;

  useEffect(() => {
    const id = pool.contractAddress ?? pool.id;
    if (id) rememberSwapHref(tokenHref(id));
  }, [pool.contractAddress, pool.id]);

  useEffect(() => {
    setMarketIndex(0);
    setBuyPrefill(null);
    setSwapSheetOpen(false);
  }, [pool.id, pool.contractAddress]);

  const copyAddress = async () => {
    if (!(await copyToClipboard(contractAddress))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const openSwapSheet = (side: "buy" | "sell", prefill?: string) => {
    if (prefill) setBuyPrefill(prefill);
    setSwapSheetSide(side);
    // Open after the opening pointer event so Radix does not treat it as an outside click.
    window.setTimeout(() => setSwapSheetOpen(true), 0);
  };

  const beFirstBuy = () => {
    if (typeof window !== "undefined" && !isPhoneDocument()) {
      setBuyPrefill("0.01");
      swapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    openSwapSheet("buy", "0.01");
  };

  const swapProps = {
    pool: activePool,
    marketIndex,
    markets: multi ? markets : undefined,
    onMarketIndex: multi ? setMarketIndex : undefined,
    onBuyPrefillConsumed: () => setBuyPrefill(null),
  };

  const heroCard = (
    <div className="desk-card token-hero-card">
      <header className="token-hero-head">
        <div className="token-hero-logo" style={{ background: pool.bannerGradient }}>
          {media ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="token-hero-logo-letter">{pool.ticker[0]}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="token-hero-title-row">
            <h1 className="token-hero-name">{pool.name}</h1>
            <span className="token-hero-ticker">${pool.ticker}</span>
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
                <span className="rounded-full bg-[#9514d1]/20 px-2 py-0.5 text-[11px] font-medium text-[#d8b4fe]">
                  {pool.bondingPhase === 0 ? "Bonding" : "Graduated"}
                </span>
              </HeaderTip>
            )}
            {trending && (
              <HeaderTip tip="Price is up over the last hour.">
                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-orange-400">
                  <Flame className="h-3 w-3" />
                  Trend
                </span>
              </HeaderTip>
            )}
          </div>

          <div className="token-hero-sub">
            <button
              type="button"
              onClick={copyAddress}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground transition hover:text-foreground sm:text-xs"
            >
              <span className="sm:hidden">
                ${pool.ticker} {shortenAddress(pool.address)}
              </span>
              <span className="hidden sm:inline">{pool.address}</span>
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
              <span className="rounded-full bg-[#10b981]/15 px-2 py-0.5 text-[10px] font-medium text-[#10b981] sm:px-2.5 sm:text-[11px]">
                Born {formatAge(ageSeconds)} ago
              </span>
            )}
            <div className="token-hero-links">
              <HeroLink href={twitterUrl} label="X">
                <XGlyph className="h-[16px] w-[16px]" />
              </HeroLink>
              <HeroLink href={websiteUrl} label="Website">
                <Globe className="h-4 w-4" strokeWidth={1.75} />
              </HeroLink>
              <HeroLink href={githubUrl} label="GitHub">
                <GithubGlyph className="h-4 w-4" />
              </HeroLink>
            </div>
          </div>
        </div>
      </header>

      <div className="token-hero-mcap">
        <p className="token-hero-mcap-value">{formatCompactUsd(live.marketCap)}</p>
        <span
          className={cn(
            "token-hero-mcap-chg",
            live.change24h >= 0 ? "token-hero-mcap-chg--up" : "token-hero-mcap-chg--down",
          )}
        >
          {formatPercent(live.change24h, true)} 24h
        </span>
      </div>

      <div className="token-hero-about">
        <div className="token-hero-about-desc min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500 sm:text-[11px]">About</p>
          <p className={cn("token-hero-about-text", description ? "text-zinc-300" : "text-zinc-500")}>
            {description ?? "No description yet."}
          </p>
        </div>

        <dl className="token-hero-stats">
          <HeroStat className="token-hero-stat--desk" label="Market cap" value={formatCompactUsd(live.marketCap)}>
            {fdv != null && <span className="token-hero-stat-sub">/ {formatCompactUsd(fdv)} FDV</span>}
          </HeroStat>
          <HeroStat
            className="token-hero-stat--mobile"
            label="Price"
            value={formatPriceUsd(live.priceUsd)}
            title={live.priceUsd > 0 ? `$${live.priceUsd}` : undefined}
          />
          <HeroStat label="Liquidity" value={formatCompactUsd(live.liquidity)} />
          <HeroStat label="24h volume" value={formatCompactUsd(live.volume24h)} />
          <HeroStat className="token-hero-stat--desk" label="ATH" value={ath > 0 ? formatCompactUsd(ath) : "—"} />
          <HeroStat
            className="token-hero-stat--mobile"
            label="Holders"
            value={live.holders > 0 ? live.holders.toLocaleString() : "—"}
          />
        </dl>
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
        <div className="token-desk-hero min-w-0">{heroCard}</div>

        <div className="token-desk-chart min-w-0 space-y-3">
          {multi && (
            <p className="rounded-lg border border-[#9514d1]/25 bg-[#9514d1]/10 px-3 py-2 text-[12px] text-zinc-300">
              This token trades on <strong className="text-foreground">{markets.length} pools</strong>
              {" "}({marketLegs.map((l) => l.label).join(" + ")}). Supply is split across them — pick a
              pool tab on the chart or swap to trade that quote.
            </p>
          )}
          <TokenCandleChart
            candles={live.candles}
            swaps={live.swaps}
            interval={chartInterval}
            onInterval={setInterval}
            marketCap={live.marketCap}
            tokenAddress={contractAddress}
            ticker={pool.ticker}
            launchedAt={pool.launchedAt}
            change5m={live.change5m}
            change1h={live.change1h}
            change6h={live.change6h}
            change24h={live.change24h}
            marketLegs={multi ? marketLegs : undefined}
            activeMarketIndex={marketIndex}
            onMarketIndex={multi ? setMarketIndex : undefined}
            onBeFirstBuy={beFirstBuy}
          />
        </div>

        <aside className="token-desk-side">
          <div className="token-desk-hooks space-y-3">
            {isClassicDesk ? <BondingProgress pool={pool} /> : <ActiveHooksPanel pool={pool} />}
          </div>
          {!isClassicDesk ? (
            <div className="token-desk-fees">
              <CreatorActions pool={activePool} />
            </div>
          ) : null}
        </aside>

        <div className="token-desk-tx-col min-w-0">
          <TokenTxTable
            tab={tab}
            onTab={setTab}
            swaps={live.swaps}
            holders={live.holderRows}
            ticker={pool.ticker}
            className="token-desk-tx"
          />
        </div>

        <aside className="token-desk-swap space-y-3">
          <div ref={swapRef}>
            <TokenSwapCard
              {...swapProps}
              buyPrefill={swapSheetOpen ? null : buyPrefill}
              footer={isClassicDesk ? <CreatorActions pool={activePool} /> : null}
            />
          </div>
        </aside>
      </div>

      <div className={cn("token-trade-bar", swapSheetOpen && "is-hidden")}>
        <button type="button" className="token-trade-bar__btn token-trade-bar__btn--buy" onClick={() => openSwapSheet("buy")}>
          Buy {pool.ticker}
        </button>
        <button type="button" className="token-trade-bar__btn token-trade-bar__btn--sell" onClick={() => openSwapSheet("sell")}>
          Sell {pool.ticker}
        </button>
      </div>

      <Sheet open={swapSheetOpen} onOpenChange={setSwapSheetOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          overlayClassName="bg-black/55 supports-backdrop-filter:backdrop-blur-sm z-[60]"
          className="token-swap-sheet z-[60] gap-0"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest(".token-trade-bar")) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest(".token-trade-bar")) event.preventDefault();
          }}
        >
          <div className="token-swap-sheet-handle" aria-hidden />
          <SheetTitle className="sr-only">
            {swapSheetSide === "buy" ? `Buy ${pool.ticker}` : `Sell ${pool.ticker}`}
          </SheetTitle>
          {swapSheetOpen ? (
            <TokenSwapCard
              key={`${swapSheetSide}-${pool.id}`}
              {...swapProps}
              variant="sheet"
              initialSide={swapSheetSide}
              buyPrefill={buyPrefill}
              footer={isClassicDesk ? <CreatorActions pool={activePool} /> : null}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
