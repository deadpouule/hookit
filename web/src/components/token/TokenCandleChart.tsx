"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { zeroAddress } from "viem";

import { PoolQuoteMark } from "@/components/token/PoolQuoteMark";
import { TokenLightweightPlot } from "@/components/token/TokenLightweightPlot";
import { TokenTradingViewChart, type TvChartStatus } from "@/components/token/TokenTradingViewChart";
import { useGeckoTerminalBars } from "@/hooks/useGeckoTerminalBars";
import { formatCompactUsd, formatPercent } from "@/lib/format";
import { TV_CANDLE_DOWN, TV_CANDLE_UP, formatTvPrice } from "@/lib/tv-chart";
import {
  CHART_TIMEFRAMES,
  barChangePct,
  barsForInterval,
  chartHudBar,
  chartWindowBars,
  dropCarryForwardBars,
  formatChartUsd,
  intervalBucketSec,
  liveCandlesToBars,
  mergeChartSeries,
  pickChartBars,
  pinLiveMcap,
  priceBarsToMcap,
  scaleBars,
  seedLaunchBars,
  ticksToBars,
  visibleCandleOhlc,
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
  "1D": "1D",
  ALL: "ALL",
};

const STYLE_KEY = "hookit_chart_style";
const SCALE_KEY = "hookit_chart_scale_v2";

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

function ChartLastPrice({
  value,
  pct,
  scale = "price",
  variant = "tv",
}: {
  value: number;
  pct: number;
  scale?: ChartScale;
  variant?: "tv" | "plot";
}) {
  if (!(value > 0)) return null;
  const up = pct >= 0;
  return (
    <div className={cn("token-chart-last-price", variant === "plot" && "token-chart-last-price--plot")}>
      <p className="token-chart-last-price-value">
        {scale === "mcap" ? formatCompactUsd(value) : `$${formatTvPrice(value)}`}
      </p>
      <span
        className="token-chart-last-price-chg"
        style={{ color: up ? TV_CANDLE_UP : TV_CANDLE_DOWN }}
      >
        {formatPercent(pct, true)}
      </span>
    </div>
  );
}

function formatDayClock(ts: number): string {
  return new Date(ts * 1000).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function applySwapTicks(bars: ChartBar[], swaps: LiveSwap[]): ChartBar[] {
  if (bars.length === 0 || swaps.length === 0) return bars;
  const next = bars.map((b) => ({ ...b }));
  for (const swap of swaps) {
    if (swap.t == null || !(swap.t > 0) || !(swap.marketCap > 0)) continue;
    const target =
      next.find((b, i) => {
        const nxt = next[i + 1];
        return swap.t! >= b.time && (!nxt || swap.t! < nxt.time);
      }) ?? next[next.length - 1];
    if (!target) continue;
    target.high = Math.max(target.high, swap.marketCap);
    target.low = Math.min(target.low, swap.marketCap);
    if (target === next[next.length - 1]) target.close = swap.marketCap;
  }
  return next;
}

function Segmented<T extends string>({
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
    <div className="flex items-center gap-0.5 rounded-lg bg-zinc-900/80 p-0.5" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={cn(
            "min-h-8 rounded-md px-2.5 py-1 font-mono text-[11px] transition sm:min-h-0",
            value === opt.id ? "bg-zinc-800 text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
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
  marketLegs?: { label: string; share: string; quoteAddress?: string; quoteAsset?: string }[];
  activeMarketIndex?: number;
  onMarketIndex?: (index: number) => void;
  onBeFirstBuy?: () => void;
  compact?: boolean;
  expanded?: boolean;
  className?: string;
}) {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [scale, setScale] = useState<ChartScale>("price");
  const [style, setStyle] = useState<ChartStyle>("candles");
  const [fitNonce, setFitNonce] = useState(0);
  const [hover, setHover] = useState<ChartBar | null>(null);
  const [tvStatus, setTvStatus] = useState<TvChartStatus>("loading");
  const geckoQuote = (() => {
    const candidates = [quoteAddress, marketLegs?.[activeMarketIndex]?.quoteAddress];
    return candidates.find((addr) => addr && addr.toLowerCase() !== zeroAddress);
  })();
  const gecko = useGeckoTerminalBars(tokenAddress, interval, geckoQuote);

  useEffect(() => {
    setScale(readStored(SCALE_KEY, ["mcap", "price"] as const, "price"));
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

  const buildBars = useCallback(
    (iv: ChartInterval, sc: ChartScale) => {
      const display = dropCarryForwardBars(barsForInterval(source, iv));
      const withTicks = applySwapTicks(display, swaps);
      return scaleBars(pinLiveMcap(withTicks, marketCap), sc);
    },
    [source, swaps, marketCap],
  );

  const bars = useMemo(() => buildBars(interval, scale), [buildBars, interval, scale]);
  const tvBarsFor = useCallback(
    (iv: ChartInterval) =>
      buildBars(iv, "price").map((b) => ({
        ...b,
        ...visibleCandleOhlc(b),
      })),
    [buildBars],
  );

  const hasData = bars.length > 0;
  const useTradingView = tvStatus !== "unavailable";
  const windowBars = chartWindowBars(intervalBucketSec(interval), launchedAt, nowSec, bars.length);
  const open = bars[0]?.open ?? 0;
  const close = bars.length ? bars[bars.length - 1]!.close : 0;
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

  if (useTradingView) {
    const legs =
      marketLegs && marketLegs.length > 1 && onMarketIndex ? (
        <div className="token-chart-toolbar token-chart-toolbar--legs">
          <div className="flex items-center gap-0.5 rounded-lg bg-zinc-900/80 p-0.5" role="tablist" aria-label="Quote pools">
            {marketLegs.map((leg, i) => (
              <button
                key={`${leg.label}-${i}`}
                type="button"
                role="tab"
                aria-selected={activeMarketIndex === i}
                onClick={() => onMarketIndex(i)}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] transition sm:min-h-0",
                  activeMarketIndex === i ? "bg-[#9514d1] text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <PoolQuoteMark quoteAddress={leg.quoteAddress} quoteAsset={leg.quoteAsset} />
                {leg.label}
                <span className="ml-0.5 opacity-70">{leg.share}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null;

    return (
      <div className={cn("desk-card token-chart-card--tv overflow-hidden", className)}>
        {legs}
        <div
          className={cn(
            "token-chart-tv-frame relative",
            expanded ? "token-chart-tv-frame--expanded" : compact ? "token-chart-tv-frame--compact" : null,
          )}
        >
          <TokenTradingViewChart
            key={`${tokenAddress ?? ticker ?? "token"}-${activeMarketIndex}`}
            ticker={ticker ?? "TOKEN"}
            name={name ?? ticker ?? "Token"}
            interval={interval}
            onInterval={onInterval}
            sinceSec={launchedAt}
            barsFor={tvBarsFor}
            onStatus={setTvStatus}
          />
          {tvStatus === "ready" && hasData ? (
            <ChartLastPrice value={tvBarsFor(interval).at(-1)?.close ?? 0} pct={pct} />
          ) : null}
          {tvStatus === "loading" ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6">
              <div className="h-[55%] w-[88%] animate-pulse rounded-md bg-zinc-800/50" />
              <p className="font-mono text-[11px] text-muted-foreground">Loading chart…</p>
            </div>
          ) : null}
          {tvStatus === "ready" && !isLoading && !hasData ? (
            <div className="token-chart-tv-empty absolute inset-x-0 bottom-3 z-10 flex justify-center px-6 text-center">
              <div className="rounded-lg border border-white/10 bg-black/70 px-4 py-2.5 backdrop-blur-sm">
                <p className="text-sm text-foreground">No trades yet</p>
                <p className="mt-0.5 text-xs text-muted-foreground/80">Be the first buy. the chart fills from on-chain swaps</p>
                {onBeFirstBuy ? (
                  <button
                    type="button"
                    onClick={onBeFirstBuy}
                    className="mt-2 rounded-lg bg-[#9514d1] px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-[#a82be0]"
                  >
                    Be first buy
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("desk-card overflow-hidden", className)}>
      <div className="token-chart-toolbar">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {marketLegs && marketLegs.length > 1 && onMarketIndex ? (
            <div className="flex items-center gap-0.5 rounded-lg bg-zinc-900/80 p-0.5" role="tablist" aria-label="Quote pools">
              {marketLegs.map((leg, i) => (
                <button
                  key={`${leg.label}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={activeMarketIndex === i}
                  onClick={() => onMarketIndex(i)}
                  className={cn(
                    "inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] transition sm:min-h-0",
                    activeMarketIndex === i
                      ? "bg-[#9514d1] text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <PoolQuoteMark quoteAddress={leg.quoteAddress} quoteAsset={leg.quoteAsset} />
                  {leg.label}
                  <span className="ml-0.5 opacity-70">{leg.share}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-0.5 rounded-lg bg-zinc-900/80 p-0.5">
            {CHART_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onInterval(tf)}
                className={cn(
                  "min-h-8 rounded-md px-2 py-1 font-mono text-[11px] transition sm:min-h-0",
                  interval === tf
                    ? "bg-zinc-800 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {TF_LABEL[tf]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Segmented
            value={scale}
            onChange={setChartScale}
            ariaLabel="Chart scale"
            options={[
              { id: "price", label: "Price" },
              { id: "mcap", label: "Mcap" },
            ]}
          />
          <Segmented
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
            className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-md px-2 py-1 text-muted-foreground transition hover:text-foreground sm:min-h-0"
            title="Reset view"
            aria-label="Reset view"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {hasData ? (
        <div className="token-chart-legend">
          <span className="token-chart-legend-id">
            {ticker ? `${ticker}` : "Token"}
            <span className="text-zinc-500"> · {TF_LABEL[interval]}</span>
          </span>
          {hud ? (
            <>
              <span>
                <span className="token-chart-legend-k">O</span> {formatChartUsd(hud.open, scale)}
              </span>
              <span>
                <span className="token-chart-legend-k">H</span> {formatChartUsd(hud.high, scale)}
              </span>
              <span>
                <span className="token-chart-legend-k">L</span> {formatChartUsd(hud.low, scale)}
              </span>
              <span>
                <span className="token-chart-legend-k">C</span> {formatChartUsd(hud.close, scale)}
              </span>
              <span style={{ color: hudUp ? TV_CANDLE_UP : TV_CANDLE_DOWN }}>{formatPercent(hudPct, true)}</span>
              <span>
                <span className="token-chart-legend-k">Vol</span>{" "}
                {hud.volume > 0 ? formatCompactUsd(hud.volume) : "—"}
              </span>
              {hover ? <span className="text-zinc-500">{formatDayClock(hover.time)}</span> : null}
            </>
          ) : null}
          <ChartLastPrice value={close} pct={pct} scale={scale} variant="plot" />
        </div>
      ) : null}

      <div
        className={cn(
          "token-chart-plot relative",
          expanded
            ? "h-[280px] sm:h-[460px] md:h-[560px]"
            : compact
              ? "h-[220px] sm:h-[280px]"
              : "h-[240px] sm:h-[340px] md:h-[420px]",
        )}
      >
        {isLoading ? (
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
            windowBars={windowBars}
            lineColor={up ? TV_CANDLE_UP : TV_CANDLE_DOWN}
            fitNonce={fitNonce}
            onHover={setHover}
          />
        )}
      </div>
    </div>
  );
}
