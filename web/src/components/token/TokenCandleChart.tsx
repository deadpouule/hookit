"use client";

import { useId, useMemo, useState } from "react";

import { formatCompactUsd, formatPercent } from "@/lib/format";
import { candlesForChartInterval } from "@/lib/chart-candles";
import type { LiveCandle } from "@/lib/token-live";
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

const LINE_UP = "#c8ff00";
const LINE_DOWN = "#ff4d6d";

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

function formatAxisTime(ts: number | undefined, index: number, total: number): string {
  if (ts && ts > 0) {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (total <= 1) return "";
  return index === 0 ? "start" : index === total - 1 ? "now" : "";
}

export function TokenCandleChart({
  candles,
  interval,
  onInterval,
  marketCap,
  liquidity,
  volume24h,
  change5m,
  change1h,
  change6h,
  change24h,
  expanded = false,
  compact = false,
  className,
}: {
  candles: LiveCandle[];
  interval: ChartInterval;
  onInterval: (next: ChartInterval) => void;
  marketCap?: number;
  liquidity?: number;
  volume24h?: number;
  change5m?: number;
  change1h?: number;
  change6h?: number;
  change24h?: number;
  compact?: boolean;
  expanded?: boolean;
  className?: string;
}) {
  const [heatmap, setHeatmap] = useState(false);
  const gradId = useId().replace(/:/g, "");
  const areaUpId = `ponsAreaUp-${gradId}`;
  const areaDownId = `ponsAreaDown-${gradId}`;

  const visible = useMemo(
    () => candlesForChartInterval(candles, interval),
    [candles, interval],
  );

  const closes = visible.map((c) => c.c);
  const min = visible.length ? Math.min(...visible.map((c) => c.l), ...closes) : 0;
  const max = visible.length ? Math.max(...visible.map((c) => c.h), ...closes) : 1;
  const pad = Math.max((max - min) * 0.08, max * 0.002, 1);
  const yMin = Math.max(0, min - pad);
  const yMax = max + pad;
  const span = Math.max(yMax - yMin, 1);

  const last = visible[visible.length - 1];
  const open = visible[0]?.o ?? last?.o ?? marketCap ?? 0;
  const close = last?.c ?? marketCap ?? 0;
  const ath = candles.length
    ? Math.max(...candles.map((c) => c.h), marketCap ?? 0)
    : marketCap ?? 0;
  const pct = changeForInterval(
    interval,
    { change5m, change1h, change6h, change24h },
    open,
    close,
  );
  const up = pct >= 0;
  const stroke = up ? LINE_UP : LINE_DOWN;

  const yLabels = useMemo(() => {
    if (!visible.length) return [];
    const steps = 4;
    return Array.from({ length: steps }, (_, i) => yMax - (span * i) / (steps - 1));
  }, [visible.length, yMax, span]);

  const points = useMemo(() => {
    if (visible.length === 0) return [] as { x: number; y: number; c: LiveCandle }[];
    if (visible.length === 1) {
      const y = 100 - ((visible[0]!.c - yMin) / span) * 100;
      return [
        { x: 0, y, c: visible[0]! },
        { x: 100, y, c: visible[0]! },
      ];
    }
    return visible.map((c, i) => ({
      x: (i / (visible.length - 1)) * 100,
      y: 100 - ((c.c - yMin) / span) * 100,
      c,
    }));
  }, [visible, yMin, span]);

  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(" ");
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    return `${linePath} L ${points[points.length - 1]!.x.toFixed(3)} 100 L ${points[0]!.x.toFixed(3)} 100 Z`;
  }, [linePath, points]);

  const lastY = points.length ? points[points.length - 1]!.y : 50;
  const xTicks = useMemo(() => {
    if (visible.length < 2) return [] as { x: number; label: string }[];
    const idxs = [0, Math.floor((visible.length - 1) / 2), visible.length - 1];
    return idxs.map((i) => ({
      x: (i / (visible.length - 1)) * 100,
      label: formatAxisTime(visible[i]?.t, i, visible.length),
    }));
  }, [visible]);

  const volMax = useMemo(() => {
    if (!heatmap || !visible.length) return 1;
    return Math.max(...visible.map((c) => Math.abs(c.h - c.l) + Math.abs(c.c - c.o)), 1);
  }, [heatmap, visible]);

  return (
    <div className={cn("desk-card overflow-hidden", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground sm:gap-x-5">
          <Stat label="Market cap" value={formatCompactUsd(marketCap ?? close)} />
          <Stat label="Liquidity" value={formatCompactUsd(liquidity ?? 0)} />
          <Stat label="24h volume" value={formatCompactUsd(volume24h ?? 0)} />
          <Stat label="ATH" value={ath > 0 ? formatCompactUsd(ath) : "—"} />
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "relative h-5 w-9 rounded-full transition",
                heatmap ? "bg-[#c8ff00]/30" : "bg-zinc-800",
              )}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={heatmap}
                onChange={(e) => setHeatmap(e.target.checked)}
                aria-label="Heatmap"
              />
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-zinc-400 transition peer-checked:translate-x-4 peer-checked:bg-[#c8ff00]",
                )}
              />
            </span>
            Heatmap
          </label>
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
        <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col justify-between px-3 py-6 pr-14 sm:px-4">
          {yLabels.map((value) => (
            <div key={value} className="flex items-center gap-2">
              <div className="h-px flex-1 bg-white/[0.04]" />
              <span className="w-12 shrink-0 text-right font-mono text-[10px] text-zinc-600">
                {formatCompactUsd(value)}
              </span>
            </div>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 px-6 text-center">
            <p className="text-sm text-muted-foreground">No trades yet</p>
            <p className="text-xs text-muted-foreground/80">Chart builds from the first on-chain swap</p>
          </div>
        ) : (
          <>
            <div className="absolute top-3 left-3 z-20 sm:top-4 sm:left-4">
              <p className="font-mono text-2xl tracking-tight text-foreground sm:text-3xl">
                {formatCompactUsd(close)}
              </p>
              <p
                className={cn(
                  "mt-0.5 font-mono text-[12px] sm:text-[13px]",
                  up ? "text-[#c8ff00]" : "text-[#ff4d6d]",
                )}
              >
                {formatPercent(pct, true)} {TF_LABEL[interval].toLowerCase()}
              </p>
            </div>

            <svg
              className="absolute inset-0 z-[2] h-full w-full"
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

              {heatmap &&
                visible.map((c, i) => {
                  const x0 = i === 0 ? 0 : ((i - 0.5) / (visible.length - 1 || 1)) * 100;
                  const x1 =
                    i === visible.length - 1
                      ? 100
                      : ((i + 0.5) / (visible.length - 1 || 1)) * 100;
                  const intensity =
                    (Math.abs(c.h - c.l) + Math.abs(c.c - c.o)) / volMax;
                  const bull = c.c >= c.o;
                  return (
                    <rect
                      key={`heat-${i}`}
                      x={x0}
                      y={70}
                      width={Math.max(x1 - x0, 0.15)}
                      height={30 * Math.max(intensity, 0.12)}
                      fill={bull ? LINE_UP : LINE_DOWN}
                      opacity={0.12 + intensity * 0.35}
                    />
                  );
                })}

              <path
                d={areaPath}
                fill={up ? `url(#${areaUpId})` : `url(#${areaDownId})`}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={linePath}
                fill="none"
                stroke={stroke}
                strokeWidth="0.45"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx="100"
                cy={lastY}
                r="0.9"
                fill={stroke}
                stroke="#0a0a0a"
                strokeWidth="0.35"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <div
              className="pointer-events-none absolute right-2 z-10 -translate-y-1/2 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium text-black"
              style={{ top: `${lastY}%`, background: stroke }}
            >
              {formatCompactUsd(close)}
            </div>

            <div className="pointer-events-none absolute inset-x-3 bottom-2 z-10 h-4 sm:inset-x-4">
              {xTicks.map((tick) => (
                <span
                  key={`${tick.x}-${tick.label}`}
                  className="absolute -translate-x-1/2 font-mono text-[10px] text-zinc-600 first:translate-x-0 last:translate-x-[-100%]"
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-zinc-500">{label}</span>
      <span className="text-foreground">{value}</span>
    </span>
  );
}
