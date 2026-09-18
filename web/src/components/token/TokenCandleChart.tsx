"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { PoolQuoteMark } from "@/components/token/PoolQuoteMark";
import { TokenLightweightPlot } from "@/components/token/TokenLightweightPlot";
import { useGeckoTerminalBars } from "@/hooks/useGeckoTerminalBars";
import { geckoQuoteTokenAddress } from "@/lib/geckoterminal";
import { definedChartUrl } from "@/lib/token-metadata";
import {
  CHART_TIMEFRAMES,
  applyTicksToBuckets,
  barsForInterval,
  chartFitAnchorIndex,
  chartWindowBars,
  ensureCurrentBar,
  forwardFillContinuous,
  intervalBucketSec,
  isWhitespaceBar,
  linkBarOpens,
  liveCandlesToBars,
  mergeChartSeries,
  openFirstTradeFromLaunch,
  pickChartBars,
  priceBarsToMcap,
  repriceBarsWithQuoteFx,
  rollQuoteFxBars,
  scaleBars,
  seedLaunchBars,
  ticksToBars,
  type ChartBar,
  type ChartInterval,
  type ChartScale,
} from "@/lib/token-chart";
import type { LiveCandle, LiveSwap } from "@/lib/token-live";
import { cn } from "@/lib/utils";

export type { ChartInterval };

const TF_LABEL: Record<ChartInterval, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  D: "D",
};

const SCALE_KEY = "hookit_chart_scale_v4";

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    if (value && (allowed as readonly string[]).includes(value)) return value as T;
  } catch {
    /* private mode */
  }
  return fallback;
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function swapsForPool(swaps: LiveSwap[], poolId?: string): LiveSwap[] {
  if (!poolId) return swaps;
  const key = poolId.toLowerCase();
  return swaps.filter((s) => !s.poolId || s.poolId.toLowerCase() === key);
}

function applySwapTicks(bars: ChartBar[], swaps: LiveSwap[], bucketSec: number, poolId?: string): ChartBar[] {
  return applyTicksToBuckets(
    bars,
    swapsForPool(swaps, poolId)
      .filter((s) => s.t != null && s.t > 0 && s.marketCap > 0)
      .map((s) => ({ t: s.t!, price: s.marketCap, volume: s.totalUsd })),
    bucketSec,
  );
}

function ChartToggle<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { id: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div className="token-chart-toggles" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={cn("token-chart-toggle", value === opt.id && "is-active")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function TokenCandleChart({
  candles,
  swaps = [],
  isLoading = false,
  interval,
  onInterval,
  marketCap,
  launchMcap,
  tokenAddress,
  launchedAt,
  quoteAddress,
  quoteUsd,
  marketLegs,
  activePoolId,
  activeMarketIndex = 0,
  onMarketIndex,
  onBeFirstBuy,
  ticker,
  name,
  expanded = false,
  compact = false,
  className,
}: {
  candles: LiveCandle[];
  swaps?: LiveSwap[];
  isLoading?: boolean;
  interval: ChartInterval;
  onInterval: (next: ChartInterval) => void;
  marketCap?: number;
  launchMcap?: number;
  tokenAddress?: string;
  ticker?: string;
  name?: string;
  launchedAt?: number;
  quoteAddress?: string;
  quoteUsd?: number;
  marketLegs?: { label: string; share: string; quoteAddress?: string; quoteAsset?: string; poolId?: string }[];
  activePoolId?: string;
  activeMarketIndex?: number;
  onMarketIndex?: (index: number) => void;
  onBeFirstBuy?: () => void;
  compact?: boolean;
  expanded?: boolean;
  className?: string;
}) {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [scale, setScale] = useState<ChartScale>("mcap");
  const [fitNonce, setFitNonce] = useState(0);
  const selectedPoolId = activePoolId ?? marketLegs?.[activeMarketIndex]?.poolId;
  const geckoQuote = geckoQuoteTokenAddress(
    marketLegs?.[activeMarketIndex]?.quoteAddress ?? quoteAddress,
  );
  const gecko = useGeckoTerminalBars(tokenAddress, "1m", geckoQuote);
  const quoteFx = useGeckoTerminalBars(geckoQuote, "1m");
  const definedUrl = definedChartUrl(tokenAddress);

  useEffect(() => {
    setScale(readStored(SCALE_KEY, ["mcap", "price"] as const, "mcap"));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 10_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setFitNonce((n) => n + 1);
  }, [interval, activeMarketIndex]);

  /** Native market-cap bars before any interval bucketing. */
  const source = useMemo(() => {
    const fromCandles = liveCandlesToBars(candles, nowSec);
    const fromSwaps = ticksToBars(
      swapsForPool(swaps, selectedPoolId)
        .filter((s) => s.t != null && s.t > 0 && s.marketCap > 0)
        .map((s) => ({ t: s.t!, price: s.marketCap, volume: s.totalUsd })),
    );
    const house = mergeChartSeries(fromCandles, fromSwaps);
    const seeded = house.length ? house : seedLaunchBars(launchedAt, launchMcap ?? marketCap ?? 0);
    const geckoMcap = priceBarsToMcap(gecko.data?.bars ?? []);
    return pickChartBars(seeded, geckoMcap);
  }, [candles, swaps, selectedPoolId, nowSec, marketCap, launchMcap, gecko.data?.bars, launchedAt]);

  const chartMcap = useMemo(() => {
    if (!(marketCap && marketCap > 0)) return marketCap;
    return Math.round(marketCap);
  }, [marketCap]);

  const buildBars = useCallback(
    (iv: ChartInterval, sc: ChartScale) => {
      const bucket = intervalBucketSec(iv);
      const display = barsForInterval(source, iv);
      const withTicks = applySwapTicks(display, swaps, bucket, selectedPoolId);
      const fx = rollQuoteFxBars(quoteFx.data?.bars ?? [], bucket);
      const liveFx =
        quoteUsd && quoteUsd > 0 ? quoteUsd : fx.length ? fx[fx.length - 1]!.close : 0;
      const repriced =
        liveFx > 0 && fx.length > 0 ? repriceBarsWithQuoteFx(withTicks, fx, liveFx) : withTicks;
      const firstSwap = swapsForPool(swaps, selectedPoolId)
        .filter((s) => s.t != null && s.t > 0)
        .sort((a, b) => (a.t ?? 0) - (b.t ?? 0))[0];
      const opened = openFirstTradeFromLaunch(repriced, launchMcap, firstSwap?.side);
      const linked = linkBarOpens(opened);
      const filled = forwardFillContinuous(linked, bucket, nowSec, fx);
      const current = ensureCurrentBar(filled, bucket, nowSec, chartMcap);
      return scaleBars(linkBarOpens(current), sc);
    },
    [source, swaps, selectedPoolId, chartMcap, launchMcap, nowSec, quoteFx.data?.bars, quoteUsd],
  );

  const bars = useMemo(() => buildBars(interval, scale), [buildBars, interval, scale]);
  const realBars = useMemo(() => bars.filter((b) => !isWhitespaceBar(b)), [bars]);

  const hasData = realBars.length > 0;
  const bucketSec = intervalBucketSec(interval);
  const anchorIndex = chartFitAnchorIndex(bars);
  const windowBars = chartWindowBars(bucketSec);

  const setChartScale = (next: ChartScale) => {
    setScale(next);
    writeStored(SCALE_KEY, next);
  };

  return (
    <div className={cn("desk-card token-chart-card w-full min-w-0 overflow-hidden", className)}>
      <div className="token-chart-toolbar">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {marketLegs && marketLegs.length > 1 && onMarketIndex ? (
            <div className="flex items-center gap-0.5" role="tablist" aria-label="Quote pools">
              {marketLegs.map((leg, i) => (
                <button
                  key={`${leg.label}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={activeMarketIndex === i}
                  onClick={() => onMarketIndex(i)}
                  className={cn(
                    "token-chart-leg",
                    activeMarketIndex === i && "is-active",
                  )}
                >
                  <PoolQuoteMark quoteAddress={leg.quoteAddress} quoteAsset={leg.quoteAsset} />
                  {leg.label}
                  <span className="opacity-70">{leg.share}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="token-chart-tfs" role="group" aria-label="Chart interval">
            {CHART_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onInterval(tf)}
                className={cn("token-chart-tf", interval === tf && "is-active")}
              >
                {TF_LABEL[tf]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ChartToggle
            value={scale}
            onChange={setChartScale}
            ariaLabel="Chart scale"
            options={[
              { id: "price", label: "Price" },
              { id: "mcap", label: "Market cap" },
            ]}
          />
          {definedUrl ? (
            <a
              href={definedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="token-chart-defined"
              title="Open chart on Defined"
              aria-label="Open chart on Defined"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/defined-mark.png" alt="" className="token-chart-defined-mark" />
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setFitNonce((n) => n + 1)}
            className="token-chart-reset"
            title="Reset view"
            aria-label="Reset view"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        className={cn(
          "token-chart-plot relative min-w-0",
          expanded
            ? "h-[280px] sm:h-[460px] md:h-[560px]"
            : compact
              ? "h-[220px] sm:h-[280px]"
              : "h-[260px] sm:h-[380px] md:h-[460px]",
        )}
      >
        {isLoading && !hasData ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6">
            <div className="h-[55%] w-[88%] animate-pulse rounded-md bg-zinc-800/50" />
            <p className="font-mono text-[11px] text-muted-foreground">Loading chart…</p>
          </div>
        ) : !hasData ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div>
              <p className="text-sm text-foreground">No trades yet</p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                Be the first buy. the chart fills from on-chain swaps
              </p>
            </div>
            {onBeFirstBuy ? (
              <button
                type="button"
                onClick={onBeFirstBuy}
                className="rounded-lg bg-[#9514d1] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-[#a82be0]"
              >
                Be first buy
              </button>
            ) : null}
          </div>
        ) : (
          <TokenLightweightPlot
            bars={bars}
            scale={scale}
            interval={interval}
            symbol={`${ticker || name || "Token"}/${marketLegs?.[activeMarketIndex]?.quoteAsset || "USD"}`}
            bucketSec={bucketSec}
            windowBars={windowBars}
            anchorIndex={anchorIndex}
            fitNonce={fitNonce}
          />
        )}
      </div>
    </div>
  );
}
