"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { zeroAddress } from "viem";

import { PoolQuoteMark } from "@/components/token/PoolQuoteMark";
import { TokenLightweightPlot } from "@/components/token/TokenLightweightPlot";
import { useGeckoTerminalBars } from "@/hooks/useGeckoTerminalBars";
import { formatPercent } from "@/lib/format";
import { TV_CANDLE_DOWN, TV_CANDLE_UP } from "@/lib/tv-chart";
import {
  CHART_TIMEFRAMES,
  applyTicksToBuckets,
  barChangePct,
  barsForInterval,
  chartFitAnchorIndex,
  chartHudBar,
  chartWindowBars,
  chartSpanSec,
  definedFdvTape,
  ensureCurrentBar,
  formatChartUsd,
  intervalBucketSec,
  isWhitespaceBar,
  linkBarOpens,
  liveCandlesToBars,
  mergeChartSeries,
  pickChartBars,
  pinLiveMcap,
  priceBarsToMcap,
  repriceBarsWithQuoteFx,
  rollQuoteFxBars,
  scaleBars,
  seedLaunchBars,
  ticksToBars,
  type ChartBar,
  type ChartInterval,
  type ChartScale,
  type ChartStyle,
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
  "1D": "D",
  ALL: "ALL",
};

const STYLE_KEY = "hookit_chart_style";
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

function changeForInterval(open: number, close: number): number {
  return open > 0 && Number.isFinite(close) ? ((close - open) / open) * 100 : 0;
}

function formatDayClock(ts: number): string {
  return new Date(ts * 1000).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function applySwapTicks(bars: ChartBar[], swaps: LiveSwap[], bucketSec: number): ChartBar[] {
  return applyTicksToBuckets(
    bars,
    swaps
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
  tokenAddress,
  launchedAt,
  quoteAddress,
  quoteUsd,
  marketLegs,
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
  tokenAddress?: string;
  ticker?: string;
  name?: string;
  launchedAt?: number;
  quoteAddress?: string;
  quoteUsd?: number;
  marketLegs?: { label: string; share: string; quoteAddress?: string; quoteAsset?: string }[];
  activeMarketIndex?: number;
  onMarketIndex?: (index: number) => void;
  onBeFirstBuy?: () => void;
  compact?: boolean;
  expanded?: boolean;
  className?: string;
}) {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [scale, setScale] = useState<ChartScale>("mcap");
  const [style, setStyle] = useState<ChartStyle>("candles");
  const [fitNonce, setFitNonce] = useState(0);
  const [hover, setHover] = useState<ChartBar | null>(null);
  const geckoQuote = (() => {
    const candidates = [quoteAddress, marketLegs?.[activeMarketIndex]?.quoteAddress];
    return candidates.find((addr) => addr && addr.toLowerCase() !== zeroAddress);
  })();
  const gecko = useGeckoTerminalBars(tokenAddress, interval, geckoQuote);
  const quoteFx = useGeckoTerminalBars(geckoQuote, "1m");

  useEffect(() => {
    setScale(readStored(SCALE_KEY, ["mcap", "price"] as const, "mcap"));
    setStyle(readStored(STYLE_KEY, ["candles", "line"] as const, "candles"));
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
      swaps
        .filter((s) => s.t != null && s.t > 0 && s.marketCap > 0)
        .map((s) => ({ t: s.t!, price: s.marketCap, volume: s.totalUsd })),
    );
    const house = mergeChartSeries(fromCandles, fromSwaps);
    const seeded = house.length ? house : seedLaunchBars(launchedAt, marketCap ?? 0);
    const geckoMcap = priceBarsToMcap(gecko.data?.bars ?? []);
    return pickChartBars(seeded, geckoMcap);
  }, [candles, swaps, nowSec, marketCap, gecko.data?.bars, launchedAt]);

  const spanSec = useMemo(
    () => chartSpanSec(source, launchedAt, nowSec),
    [source, launchedAt, nowSec],
  );

  const chartMcap = useMemo(() => {
    if (!(marketCap && marketCap > 0)) return marketCap;
    return Math.round(marketCap);
  }, [marketCap]);

  const buildBars = useCallback(
    (iv: ChartInterval, sc: ChartScale) => {
      const bucket = intervalBucketSec(iv, spanSec);
      const display = barsForInterval(source, iv, spanSec);
      const withTicks = applySwapTicks(display, swaps, bucket);
      const pinned = pinLiveMcap(withTicks, chartMcap);
      const current = ensureCurrentBar(pinned, bucket, nowSec, chartMcap);
      const fx = rollQuoteFxBars(quoteFx.data?.bars ?? [], bucket);
      const liveFx =
        quoteUsd && quoteUsd > 0 ? quoteUsd : fx.length ? fx[fx.length - 1]!.close : 0;
      const marked =
        liveFx > 0 && fx.length > 0
          ? linkBarOpens(repriceBarsWithQuoteFx(current, fx, liveFx))
          : linkBarOpens(current);
      return definedFdvTape(scaleBars(marked, sc), bucket, nowSec, chartWindowBars());
    },
    [source, swaps, chartMcap, nowSec, quoteFx.data?.bars, quoteUsd, spanSec],
  );

  const bars = useMemo(() => buildBars(interval, scale), [buildBars, interval, scale]);
  const realBars = useMemo(() => bars.filter((b) => !isWhitespaceBar(b)), [bars]);

  const hasData = realBars.length > 0;
  const bucketSec = intervalBucketSec(interval, spanSec);
  const anchorIndex = chartFitAnchorIndex(bars);
  const windowBars = chartWindowBars();
  const open = realBars[0]?.open ?? 0;
  const close = realBars.length ? realBars[realBars.length - 1]!.close : 0;
  const pct = changeForInterval(open, close);
  const up = pct >= 0;
  const hud = chartHudBar(bars, hover);
  const hudPct = hud ? barChangePct(hud) : 0;
  const hudUp = hudPct >= 0;

  const setChartScale = (next: ChartScale) => {
    setScale(next);
    writeStored(SCALE_KEY, next);
  };
  const setChartStyle = (next: ChartStyle) => {
    setStyle(next);
    writeStored(STYLE_KEY, next);
  };

  return (
    <div className={cn("desk-card token-chart-card overflow-hidden", className)}>
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
              { id: "mcap", label: "FDV" },
            ]}
          />
          <ChartToggle
            value={style}
            onChange={setChartStyle}
            ariaLabel="Chart type"
            options={[
              { id: "candles", label: "Candles" },
              { id: "line", label: "Line" },
            ]}
          />
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

      {hasData && hud ? (
        <div className="token-chart-stats" aria-live="polite">
          <div className="token-chart-stats-main">
            <span className="token-chart-stats-id">
              {ticker || name || "Token"}
              <span className="token-chart-stats-tf">{TF_LABEL[interval]}</span>
            </span>
            <div className="token-chart-stats-ohlc">
              <span className="token-chart-stat">
                <span className="token-chart-legend-k">O</span>
                <span className="token-chart-stat-v">{formatChartUsd(hud.open, scale)}</span>
              </span>
              <span className="token-chart-stat token-chart-stat--high">
                <span className="token-chart-legend-k">H</span>
                <span className="token-chart-stat-v">{formatChartUsd(hud.high, scale)}</span>
              </span>
              <span className="token-chart-stat token-chart-stat--low">
                <span className="token-chart-legend-k">L</span>
                <span className="token-chart-stat-v">{formatChartUsd(hud.low, scale)}</span>
              </span>
              <span className="token-chart-stat token-chart-stat--close">
                <span className="token-chart-legend-k">C</span>
                <span className="token-chart-stat-v">{formatChartUsd(hud.close, scale)}</span>
              </span>
            </div>
          </div>
          <div className="token-chart-stats-side">
            <span
              className="token-chart-stats-chg"
              style={{ color: hudUp ? TV_CANDLE_UP : TV_CANDLE_DOWN }}
            >
              {formatPercent(hudPct, true)}
            </span>
            {hover ? <span className="token-chart-stats-time">{formatDayClock(hover.time)}</span> : null}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "token-chart-plot relative",
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
            style={style}
            scale={scale}
            interval={interval}
            bucketSec={bucketSec}
            windowBars={windowBars}
            anchorIndex={anchorIndex}
            lineColor={up ? TV_CANDLE_UP : TV_CANDLE_DOWN}
            fitNonce={fitNonce}
            onHover={setHover}
          />
        )}
      </div>
    </div>
  );
}
