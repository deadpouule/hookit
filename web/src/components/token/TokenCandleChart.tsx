"use client";

import { useEffect, useMemo, useState } from "react";

import { PoolQuoteMark } from "@/components/token/PoolQuoteMark";
import { TokenLightweightPlot } from "@/components/token/TokenLightweightPlot";
import { formatCompactUsd, formatPercent } from "@/lib/format";
import { barsForInterval, liveCandlesToBars, type ChartBar } from "@/lib/token-chart";
import type { LiveCandle, LiveSwap } from "@/lib/token-live";
import { cn } from "@/lib/utils";

const TIMEFRAMES = ["5m", "1h", "6h", "1D", "ALL"] as const;
export type ChartInterval = (typeof TIMEFRAMES)[number];

const TF_LABEL: Record<ChartInterval, string> = {
  "5m": "5M",
  "1h": "1H",
  "6h": "6H",
  "1D": "1D",
  ALL: "ALL",
};

function changeForInterval(
  interval: ChartInterval,
  changes: { change5m?: number; change1h?: number; change6h?: number; change24h?: number },
  open: number,
  close: number,
): number {
  if (interval === "5m" && changes.change5m != null) return changes.change5m;
  if (interval === "1h" && changes.change1h != null) return changes.change1h;
  if (interval === "6h" && changes.change6h != null) return changes.change6h;
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

export function TokenCandleChart({
  candles,
  swaps = [],
  interval,
  onInterval,
  marketCap,
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
  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 10_000);
    return () => window.clearInterval(id);
  }, []);

  const bars = useMemo(() => {
    const native = liveCandlesToBars(candles, nowSec, marketCap);
    const withTicks = applySwapTicks(native, swaps);
    return barsForInterval(withTicks, interval);
  }, [candles, swaps, nowSec, marketCap, interval]);

  const hasData = bars.length > 0;
  const open = bars[0]?.open ?? marketCap ?? 0;
  const close = bars.length ? bars[bars.length - 1]!.close : (marketCap ?? 0);
  const pct = changeForInterval(interval, { change5m, change1h, change6h, change24h }, open, close);
  const up = pct >= 0;

  const [hover, setHover] = useState<ChartBar | null>(null);
  const headerValue = hover ? hover.close : close;

  return (
    <div className={cn("desk-card overflow-hidden", className)}>
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-b border-border px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="flex items-center gap-0.5 rounded-lg bg-zinc-900/80 p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onInterval(tf)}
                className={cn(
                  "min-h-9 rounded-md px-2.5 py-1 font-mono text-[11px] transition sm:min-h-0",
                  interval === tf
                    ? "bg-zinc-700 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {TF_LABEL[tf]}
              </button>
            ))}
          </div>
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
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Market cap</p>
              <p className="font-mono text-2xl tracking-tight text-foreground sm:text-3xl">
                {formatCompactUsd(headerValue)}
              </p>
              <p
                className={cn(
                  "mt-0.5 font-mono text-[12px] sm:text-[13px]",
                  hover ? "text-zinc-400" : up ? "text-[#26a69a]" : "text-[#ef5350]",
                )}
              >
                {hover
                  ? formatDayClock(hover.time)
                  : `${formatPercent(pct, true)} ${TF_LABEL[interval].toLowerCase()}`}
              </p>
            </div>
            <TokenLightweightPlot bars={bars} onHover={setHover} />
          </>
        )}
      </div>
    </div>
  );
}
