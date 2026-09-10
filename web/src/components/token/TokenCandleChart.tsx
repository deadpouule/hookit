"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { PoolQuoteMark } from "@/components/token/PoolQuoteMark";
import { TokenLightweightPlot } from "@/components/token/TokenLightweightPlot";
import { useGeckoTerminalBars } from "@/hooks/useGeckoTerminalBars";
import { formatPercent } from "@/lib/format";
import {
  CHART_TIMEFRAMES,
  barsForInterval,
  fillEmptyBars,
  formatChartUsd,
  intervalBucketSec,
  liveCandlesToBars,
  mergeChartSeries,
  pickChartBars,
  pinLiveMcap,
  priceBarsToMcap,
  scaleBars,
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
  "1m": "1M",
  "5m": "5M",
  "15m": "15M",
  "1h": "1H",
  "4h": "4H",
  "1D": "1D",
  ALL: "ALL",
};

const STYLE_KEY = "hookit_chart_style";
const SCALE_KEY = "hookit_chart_scale";

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

function changeForInterval(
  interval: ChartInterval,
  changes: { change5m?: number; change1h?: number; change6h?: number; change24h?: number },
  open: number,
  close: number,
): number {
  if ((interval === "1m" || interval === "5m" || interval === "15m") && changes.change5m != null) {
    return changes.change5m;
  }
  if (interval === "1h" && changes.change1h != null) return changes.change1h;
  if (interval === "4h" && changes.change6h != null) return changes.change6h;
  if ((interval === "1D" || interval === "ALL") && changes.change24h != null) return changes.change24h;
  return open > 0 ? ((close - open) / open) * 100 : 0;
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
            "min-h-9 rounded-md px-2.5 py-1 font-mono text-[11px] transition sm:min-h-0",
            value === opt.id ? "bg-zinc-700 text-foreground" : "text-muted-foreground hover:text-foreground",
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
  interval,
  onInterval,
  marketCap,
  tokenAddress,
  change5m,
  change1h,
  change6h,
  change24h,
  marketLegs,
  activeMarketIndex = 0,
  onMarketIndex,
  onBeFirstBuy,
  expanded = false,
  compact = false,
  className,
}: {
  candles: LiveCandle[];
  swaps?: LiveSwap[];
  interval: ChartInterval;
  onInterval: (next: ChartInterval) => void;
  marketCap?: number;
  tokenAddress?: string;
  change5m?: number;
  change1h?: number;
  change6h?: number;
  change24h?: number;
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
  const gecko = useGeckoTerminalBars(tokenAddress, interval);

  useEffect(() => {
    setScale(readStored(SCALE_KEY, ["mcap", "price"] as const, "mcap"));
    setStyle(readStored(STYLE_KEY, ["candles", "line"] as const, "candles"));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 10_000);
    return () => window.clearInterval(id);
  }, []);

  const bars = useMemo(() => {
    const fromCandles = liveCandlesToBars(candles, nowSec, marketCap);
    const fromSwaps = ticksToBars(
      swaps
        .filter((s) => s.t != null && s.t > 0 && s.marketCap > 0)
        .map((s) => ({ t: s.t!, price: s.marketCap, volume: s.totalUsd })),
    );
    const house = mergeChartSeries(fromCandles, fromSwaps);
    const geckoMcap = pinLiveMcap(priceBarsToMcap(gecko.data?.bars ?? []), marketCap);
    const source = pickChartBars(house, geckoMcap);
    const withTicks = applySwapTicks(source, swaps);
    const bucket = intervalBucketSec(interval);
    const display = barsForInterval(withTicks, interval);
    return scaleBars(fillEmptyBars(display, bucket, nowSec), scale);
  }, [candles, swaps, nowSec, marketCap, interval, scale, gecko.data?.bars]);

  const hasData = bars.length > 0;
  const open = bars[0]?.open ?? 0;
  const close = bars.length ? bars[bars.length - 1]!.close : 0;
  const pct = changeForInterval(interval, { change5m, change1h, change6h, change24h }, open, close);
  const up = pct >= 0;
  const headerValue = hover ? hover.close : close;

  const setChartScale = (next: ChartScale) => {
    setScale(next);
    writeStored(SCALE_KEY, next);
  };
  const setChartStyle = (next: ChartStyle) => {
    setStyle(next);
    writeStored(STYLE_KEY, next);
  };

  return (
    <div className={cn("desk-card overflow-hidden", className)}>
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-b border-border px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
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
                    "inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] transition sm:min-h-0",
                    activeMarketIndex === i
                      ? "bg-[#9514d1] text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <PoolQuoteMark quoteAddress={leg.quoteAddress} quoteAsset={leg.quoteAsset} />
                  {leg.label}
                  <span className="ml-1 opacity-70">{leg.share}</span>
                </button>
              ))}
            </div>
          ) : null}
          <Segmented
            value={scale}
            onChange={setChartScale}
            ariaLabel="Chart scale"
            options={[
              { id: "price", label: "Price" },
              { id: "mcap", label: "MCap" },
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
          <div className="flex items-center gap-0.5 rounded-lg bg-zinc-900/80 p-0.5">
            {CHART_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onInterval(tf)}
                className={cn(
                  "min-h-9 rounded-md px-2 py-1 font-mono text-[11px] transition sm:min-h-0",
                  interval === tf
                    ? "bg-zinc-700 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {TF_LABEL[tf]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFitNonce((n) => n + 1)}
            className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] text-muted-foreground transition hover:text-foreground sm:min-h-0"
            title="Reset view"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
      </div>

      <div
        className={cn(
          "relative bg-chart-bg",
          expanded
            ? "h-[280px] sm:h-[460px] md:h-[560px]"
            : compact
              ? "h-[220px] sm:h-[280px]"
              : "h-[240px] sm:h-[340px] md:h-[420px]",
        )}
      >
        {!hasData ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div>
              <p className="text-sm text-foreground">No trades yet</p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                Be the first buy — the chart fills from on-chain swaps
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
          <>
            <div className="pointer-events-none absolute top-3 left-3 z-20 sm:top-4 sm:left-4">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                {scale === "mcap" ? "Market cap" : "Price"}
              </p>
              <p className="font-mono text-2xl tracking-tight text-foreground sm:text-3xl">
                {formatChartUsd(headerValue, scale)}
              </p>
              <p
                className={cn(
                  "mt-0.5 font-mono text-[12px] sm:text-[13px]",
                  hover ? "text-zinc-400" : up ? "text-[#10b981]" : "text-[#ef4444]",
                )}
              >
                {hover
                  ? formatDayClock(hover.time)
                  : `${formatPercent(pct, true)} ${TF_LABEL[interval].toLowerCase()}`}
              </p>
            </div>
            <TokenLightweightPlot
              bars={bars}
              style={style}
              scale={scale}
              lineColor={up ? "#10b981" : "#ef4444"}
              fitNonce={fitNonce}
              onHover={setHover}
            />
          </>
        )}
      </div>
    </div>
  );
}
