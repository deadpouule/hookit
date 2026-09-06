"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { PoolQuoteMark } from "@/components/token/PoolQuoteMark";
import { formatCompactUsd, formatPercent } from "@/lib/format";
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

/** Visible time window in seconds (ALL = full history). */
const TF_WINDOW_SEC: Record<ChartInterval, number | null> = {
  "5m": 5 * 60,
  "1h": 60 * 60,
  "6h": 6 * 60 * 60,
  "1D": 24 * 60 * 60,
  ALL: null,
};

const CANDLE_SEC = 300;
const PLOT_TOP = 14;
const PLOT_BOTTOM = 90;
const LINE_UP = "#9514d1";
const LINE_DOWN = "#ff4d6d";
/** Clock tick so the "now" edge and the hovered timestamp keep moving between data refreshes. */
const NOW_TICK_MS = 10_000;

type SeriesPoint = { t: number; v: number };
type PlotPoint = { x: number; y: number; t: number | null; v: number };

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

function formatClock(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDayClock(ts: number): string {
  return new Date(ts * 1000).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAxisTime(ts: number, spanSec: number): string {
  if (spanSec > 36 * 3600) {
    return new Date(ts * 1000).toLocaleDateString([], { day: "numeric", month: "short" });
  }
  return formatClock(ts);
}

/**
 * Flatten sparse 5m candles + individual swaps into one (time, market cap) series.
 * Candles contribute open at bucket start and close at bucket end; swaps add exact ticks.
 */
function buildTimeSeries(candles: LiveCandle[], swaps: LiveSwap[], nowSec: number): SeriesPoint[] {
  const raw: SeriesPoint[] = [];
  for (const c of candles) {
    if (c.t == null || !(c.t > 0)) continue;
    if (c.o > 0) raw.push({ t: c.t, v: c.o });
    // The live bucket has not closed yet — pin its close to "now" instead of the future.
    if (c.c > 0) raw.push({ t: Math.max(c.t, Math.min(c.t + CANDLE_SEC - 1, nowSec)), v: c.c });
  }
  for (const s of swaps) {
    if (s.t == null || !(s.t > 0) || !(s.marketCap > 0)) continue;
    raw.push({ t: s.t, v: s.marketCap });
  }
  raw.sort((a, b) => a.t - b.t);
  const out: SeriesPoint[] = [];
  for (const p of raw) {
    const prev = out[out.length - 1];
    if (prev && prev.t === p.t) {
      prev.v = p.v;
      continue;
    }
    out.push(p);
  }
  return out;
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
  /** Individual trades — add exact ticks between 5m candles when timestamps are known. */
  swaps?: LiveSwap[];
  interval: ChartInterval;
  onInterval: (next: ChartInterval) => void;
  marketCap?: number;
  change5m?: number;
  change1h?: number;
  change6h?: number;
  change24h?: number;
  /** Multi-pair legs shown as pool tabs above the plot. */
  marketLegs?: { label: string; share: string; quoteAddress?: string; quoteAsset?: string }[];
  activeMarketIndex?: number;
  onMarketIndex?: (index: number) => void;
  /** Empty-state CTA — jump user into the swap card. */
  onBeFirstBuy?: () => void;
  compact?: boolean;
  expanded?: boolean;
  className?: string;
}) {
  const gradId = useId().replace(/:/g, "");
  const areaUpId = `ponsAreaUp-${gradId}`;
  const areaDownId = `ponsAreaDown-${gradId}`;

  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), NOW_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const series = useMemo(() => buildTimeSeries(candles, swaps, nowSec), [candles, swaps, nowSec]);
  const timeBased = series.length >= 1;

  const currentValue =
    marketCap && marketCap > 0
      ? marketCap
      : series.length
        ? series[series.length - 1]!.v
        : candles[candles.length - 1]?.c ?? 0;

  /**
   * Visible series: window-clipped, with the pre-window value carried to the left edge
   * and the live market cap pinned at "now" on the right edge.
   */
  const { points: plotPoints, tStart, tEnd, hasData } = useMemo(() => {
    if (timeBased) {
      const now = Math.max(nowSec, series[series.length - 1]!.t);
      const win = TF_WINDOW_SEC[interval];
      const firstT = series[0]!.t;
      const start = win == null ? Math.min(firstT, now - 60) : now - win;
      const inWin = series.filter((p) => p.t >= start && p.t <= now);
      const before = series.filter((p) => p.t < start);
      const carried = before.length ? before[before.length - 1]!.v : inWin[0]?.v ?? currentValue;
      const pts: SeriesPoint[] = [{ t: start, v: carried }, ...inWin];
      if (currentValue > 0 && pts[pts.length - 1]!.t < now) pts.push({ t: now, v: currentValue });
      else if (currentValue > 0) pts[pts.length - 1] = { t: now, v: currentValue };
      const spanT = Math.max(now - start, 1);
      return {
        points: pts.map((p) => ({ x: ((p.t - start) / spanT) * 100, y: 0, t: p.t, v: p.v })),
        tStart: start,
        tEnd: now,
        hasData: inWin.length > 0 || before.length > 0,
      };
    }
    // No timestamps (sparse / synthetic data): fall back to evenly spaced closes.
    const closes = candles.map((c) => c.c).filter((v) => v > 0);
    if (closes.length === 0) {
      return { points: [] as PlotPoint[], tStart: 0, tEnd: 0, hasData: false };
    }
    const vals = closes.length === 1 ? [closes[0]!, closes[0]!] : closes;
    return {
      points: vals.map((v, i) => ({ x: (i / (vals.length - 1)) * 100, y: 0, t: null, v })),
      tStart: 0,
      tEnd: 0,
      hasData: true,
    };
  }, [timeBased, series, interval, nowSec, currentValue, candles]);

  const values = plotPoints.map((p) => p.v);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const pad = Math.max((max - min) * 0.12, max * 0.004, 1);
  const yMin = Math.max(0, min - pad);
  const yMax = max + pad;
  const span = Math.max(yMax - yMin, 1);

  // Keep the curve clear of the header value (top) and the time axis (bottom).
  const points: PlotPoint[] = useMemo(
    () => plotPoints.map((p) => ({ ...p, y: PLOT_TOP + (1 - (p.v - yMin) / span) * (PLOT_BOTTOM - PLOT_TOP) })),
    [plotPoints, yMin, span],
  );

  const open = points[0]?.v ?? currentValue;
  const close = points.length ? points[points.length - 1]!.v : currentValue;
  const pct = changeForInterval(interval, { change5m, change1h, change6h, change24h }, open, close);
  const up = pct >= 0;
  const stroke = up ? LINE_UP : LINE_DOWN;

  const yLabels = useMemo(() => {
    if (!points.length) return [];
    const steps = 4;
    return Array.from({ length: steps }, (_, i) => yMax - (span * i) / (steps - 1));
  }, [points.length, yMax, span]);

  // Step-after path: market cap holds flat between trades and jumps at each swap.
  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    const parts: string[] = [`M ${points[0]!.x.toFixed(3)} ${points[0]!.y.toFixed(3)}`];
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1]!;
      const cur = points[i]!;
      parts.push(`L ${cur.x.toFixed(3)} ${prev.y.toFixed(3)}`);
      parts.push(`L ${cur.x.toFixed(3)} ${cur.y.toFixed(3)}`);
    }
    return parts.join(" ");
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    return `${linePath} L ${points[points.length - 1]!.x.toFixed(3)} 100 L ${points[0]!.x.toFixed(3)} 100 Z`;
  }, [linePath, points]);

  const lastPoint = points.length ? points[points.length - 1]! : null;

  const xTicks = useMemo(() => {
    if (!timeBased || tEnd <= tStart) return [] as { x: number; label: string }[];
    const spanSec = tEnd - tStart;
    const count = compact ? 3 : 4;
    return Array.from({ length: count }, (_, i) => {
      const frac = i / (count - 1);
      return { x: frac * 100, label: formatAxisTime(tStart + spanSec * frac, spanSec) };
    });
  }, [timeBased, tStart, tEnd, compact]);

  // Hover / scrub: snap to the nearest data point by x.
  const plotRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = plotRef.current;
      if (!el || points.length === 0) return;
      const rect = el.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < points.length; i += 1) {
        const d = Math.abs(points[i]!.x - xPct);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      setHoverIdx(best);
    },
    [points],
  );
  const onPointerLeave = useCallback(() => setHoverIdx(null), []);

  const hover = hoverIdx != null && points[hoverIdx] ? points[hoverIdx]! : null;
  const headerValue = hover ? hover.v : close;
  const tooltipOnLeft = hover ? hover.x > 68 : false;

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
        <div
          className="pointer-events-none absolute inset-x-0 z-[1] flex flex-col justify-between px-3 pr-14 sm:px-4"
          style={{ top: `${PLOT_TOP}%`, bottom: `${100 - PLOT_BOTTOM}%` }}
        >
          {yLabels.map((value) => (
            <div key={value} className="flex items-center gap-2">
              <div className="h-px flex-1 bg-white/[0.04]" />
              <span className="w-12 shrink-0 text-right font-mono text-[10px] text-zinc-600">
                {formatCompactUsd(value)}
              </span>
            </div>
          ))}
        </div>

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
              <p className="font-mono text-2xl tracking-tight text-foreground sm:text-3xl">
                {formatCompactUsd(headerValue)}
              </p>
              <p
                className={cn(
                  "mt-0.5 font-mono text-[12px] sm:text-[13px]",
                  hover ? "text-zinc-400" : up ? "text-[#9514d1]" : "text-[#ff4d6d]",
                )}
              >
                {hover && hover.t != null
                  ? formatDayClock(hover.t)
                  : `${formatPercent(pct, true)} ${TF_LABEL[interval].toLowerCase()}`}
              </p>
            </div>

            <div
              ref={plotRef}
              className="absolute inset-0 z-[2] cursor-crosshair touch-pan-y"
              onPointerMove={onPointerMove}
              onPointerDown={onPointerMove}
              onPointerLeave={onPointerLeave}
              onPointerCancel={onPointerLeave}
            >
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden
              >
                <defs>
                  <linearGradient id={areaUpId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={LINE_UP} stopOpacity="0.35" />
                    <stop offset="55%" stopColor={LINE_UP} stopOpacity="0.08" />
                    <stop offset="100%" stopColor={LINE_UP} stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id={areaDownId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={LINE_DOWN} stopOpacity="0.32" />
                    <stop offset="55%" stopColor={LINE_DOWN} stopOpacity="0.08" />
                    <stop offset="100%" stopColor={LINE_DOWN} stopOpacity="0" />
                  </linearGradient>
                </defs>

                <path d={areaPath} fill={up ? `url(#${areaUpId})` : `url(#${areaDownId})`} />
                <path
                  d={linePath}
                  fill="none"
                  stroke={stroke}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {lastPoint ? (
                <span
                  className="pointer-events-none absolute z-[3] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[#0a0a0a]"
                  style={{ left: `${lastPoint.x}%`, top: `${lastPoint.y}%`, background: stroke }}
                />
              ) : null}

              {hover ? (
                <>
                  <span
                    className="pointer-events-none absolute inset-y-0 z-[3] w-px bg-white/25"
                    style={{ left: `${hover.x}%` }}
                  />
                  <span
                    className="pointer-events-none absolute z-[4] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[#0a0a0a]"
                    style={{ left: `${hover.x}%`, top: `${hover.y}%`, background: stroke }}
                  />
                  <div
                    className={cn(
                      "pointer-events-none absolute z-[5] -translate-y-1/2 rounded-lg border border-white/10 bg-[#141414]/95 px-2.5 py-1.5 shadow-lg backdrop-blur",
                      tooltipOnLeft ? "-translate-x-[calc(100%+12px)]" : "translate-x-3",
                    )}
                    style={{ left: `${hover.x}%`, top: `${Math.min(Math.max(hover.y, 14), 86)}%` }}
                  >
                    <p className="text-[10px] text-zinc-500">Market cap</p>
                    <p className="font-mono text-[13px] font-medium text-foreground">
                      {formatCompactUsd(hover.v)}
                    </p>
                    {hover.t != null ? (
                      <p className="mt-0.5 whitespace-nowrap font-mono text-[10px] text-zinc-500">
                        {formatDayClock(hover.t)}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>

            {lastPoint ? (
              <div
                className="pointer-events-none absolute right-2 z-10 -translate-y-1/2 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium text-white"
                style={{ top: `${lastPoint.y}%`, background: stroke }}
              >
                {formatCompactUsd(close)}
              </div>
            ) : null}

            <div className="pointer-events-none absolute bottom-2 left-3 right-14 z-10 h-4 sm:left-4">
              {xTicks.map((tick) => (
                <span
                  key={`${tick.x}-${tick.label}`}
                  className="absolute -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-zinc-600 first:translate-x-0 last:translate-x-[-100%]"
                  style={{ left: `${tick.x}%` }}
                >
                  {tick.label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
