"use client";

import { BarChart3, Crosshair, Minus, Pencil, TrendingUp } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

import { formatCompactUsd, formatPercent } from "@/lib/format";
import { candlesForChartInterval } from "@/lib/chart-candles";
import type { LiveCandle } from "@/lib/token-live";
import { cn } from "@/lib/utils";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"] as const;
export type ChartInterval = (typeof TIMEFRAMES)[number];

const TOOLS = [
  { id: "cursor", icon: Crosshair, label: "Cursor" },
  { id: "trend", icon: TrendingUp, label: "Trend line" },
  { id: "line", icon: Minus, label: "Horizontal line" },
  { id: "draw", icon: Pencil, label: "Draw" },
  { id: "volume", icon: BarChart3, label: "Volume" },
] as const;

type ChartToolId = (typeof TOOLS)[number]["id"];

type ChartPoint = { xPct: number; yPct: number; price: number };

type TrendLine = { p1: ChartPoint; p2: ChartPoint };

type DrawPath = { points: ChartPoint[] };

function candleVolume(candle: LiveCandle): number {
  return Math.abs(candle.h - candle.l) + Math.abs(candle.c - candle.o);
}

function chartPointFromEvent(
  event: ReactMouseEvent<HTMLElement>,
  element: HTMLElement,
  min: number,
  span: number,
): ChartPoint {
  const rect = element.getBoundingClientRect();
  const xPct = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  const yPct = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
  const price = min + (1 - yPct) * span;
  return { xPct, yPct, price };
}

export function TokenCandleChart({
  candles,
  interval,
  onInterval,
  marketCap,
  change24h,
  expanded = false,
  compact = false,
  fillHeight = false,
  className,
}: {
  candles: LiveCandle[];
  interval: ChartInterval;
  onInterval: (next: ChartInterval) => void;
  marketCap?: number;
  change24h?: number;
  compact?: boolean;
  expanded?: boolean;
  fillHeight?: boolean;
  className?: string;
}) {
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [activeTool, setActiveTool] = useState<ChartToolId>("cursor");
  const [showVolume, setShowVolume] = useState(false);
  const [hLines, setHLines] = useState<number[]>([]);
  const [trendDraft, setTrendDraft] = useState<ChartPoint | null>(null);
  const [trendLines, setTrendLines] = useState<TrendLine[]>([]);
  const [drawPaths, setDrawPaths] = useState<DrawPath[]>([]);
  const [currentDraw, setCurrentDraw] = useState<DrawPath | null>(null);

  const visible = useMemo(
    () => candlesForChartInterval(candles, interval),
    [candles, interval],
  );
  const min = visible.length ? Math.min(...visible.map((c) => c.l)) : 0;
  const max = visible.length ? Math.max(...visible.map((c) => c.h)) : 1;
  const span = Math.max(max - min, 1);
  const labels = visible.length ? [max, min + span * 0.66, min + span * 0.33, min] : [];
  const last = visible[visible.length - 1];
  const open = visible[0]?.o ?? last?.o ?? marketCap ?? 0;
  const high = visible.length ? Math.max(...visible.map((c) => c.h)) : open;
  const low = visible.length ? Math.min(...visible.map((c) => c.l)) : open;
  const close = last?.c ?? marketCap ?? 0;
  const pct = change24h ?? (open > 0 ? ((close - open) / open) * 100 : 0);
  const up = pct >= 0;

  const volumeMax = useMemo(() => {
    if (!visible.length) return 1;
    return Math.max(...visible.map(candleVolume), 1);
  }, [visible]);

  const selectTool = useCallback((toolId: ChartToolId) => {
    if (toolId === "volume") {
      setShowVolume((prev) => !prev);
      setActiveTool("volume");
      return;
    }
    setActiveTool(toolId);
    if (toolId === "cursor") setTrendDraft(null);
  }, []);

  const handleChartClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const area = chartAreaRef.current;
      if (!area || visible.length === 0) return;

      const point = chartPointFromEvent(event, area, min, span);

      if (activeTool === "line") {
        setHLines((prev) => [...prev, point.price]);
        return;
      }

      if (activeTool === "trend") {
        if (!trendDraft) {
          setTrendDraft(point);
          return;
        }
        setTrendLines((prev) => [...prev, { p1: trendDraft, p2: point }]);
        setTrendDraft(null);
      }
    },
    [activeTool, min, span, trendDraft, visible.length],
  );

  const handleDrawStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (activeTool !== "draw" || !chartAreaRef.current || visible.length === 0) return;
      const point = chartPointFromEvent(event, chartAreaRef.current, min, span);
      setCurrentDraw({ points: [point] });
    },
    [activeTool, min, span, visible.length],
  );

  const handleDrawMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (activeTool !== "draw" || !currentDraw || !chartAreaRef.current) return;
      const point = chartPointFromEvent(event, chartAreaRef.current, min, span);
      setCurrentDraw((prev) =>
        prev ? { points: [...prev.points, point] } : null,
      );
    },
    [activeTool, currentDraw, min, span],
  );

  const handleDrawEnd = useCallback(() => {
    if (!currentDraw || currentDraw.points.length < 2) {
      setCurrentDraw(null);
      return;
    }
    setDrawPaths((prev) => [...prev, currentDraw]);
    setCurrentDraw(null);
  }, [currentDraw]);

  const priceToBottomPct = (price: number) => `${((price - min) / span) * 100}%`;

  const chartInteractive = visible.length > 0 && activeTool !== "cursor" && activeTool !== "volume";

  return (
    <div className={cn("desk-card overflow-hidden", fillHeight && "token-candle-chart--fill", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>Market Cap</span>
          {visible.length > 0 ? (
            <>
              <span>
                O <span className="text-foreground">{formatCompactUsd(open)}</span>
              </span>
              <span>
                H <span className="text-foreground">{formatCompactUsd(high)}</span>
              </span>
              <span>
                L <span className="text-foreground">{formatCompactUsd(low)}</span>
              </span>
              <span>
                C <span className="text-foreground">{formatCompactUsd(close)}</span>
              </span>
              <span className={up ? "text-emerald-400" : "text-red-400"}>
                {formatPercent(pct, true)}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Waiting for first trade</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onInterval(tf)}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-[11px] transition",
                interval === tf
                  ? "bg-[#9514d1] text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "relative bg-chart-bg",
          fillHeight
            ? "min-h-[360px] flex-1"
            : expanded
              ? "h-[460px] sm:h-[560px]"
              : compact
                ? "h-[240px] sm:h-[280px]"
                : "h-[340px] sm:h-[420px]",
        )}
      >
        <div className="candle-grid absolute inset-0" />
        {visible.length === 0 ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 px-6 text-center">
            <p className="text-sm text-muted-foreground">No trades yet</p>
            <p className="text-xs text-muted-foreground/80">Chart builds from the first on-chain swap</p>
          </div>
        ) : (
          <>
            <div
              ref={chartAreaRef}
              className={cn(
                "absolute inset-0 z-[1]",
                chartInteractive && "cursor-crosshair",
                activeTool === "draw" && "cursor-crosshair",
              )}
              onClick={handleChartClick}
              onMouseDown={handleDrawStart}
              onMouseMove={handleDrawMove}
              onMouseUp={handleDrawEnd}
              onMouseLeave={handleDrawEnd}
            >
              <div
                className={cn(
                  "absolute inset-x-2 top-4 flex items-end gap-px pr-16",
                  showVolume ? "bottom-[28%]" : "bottom-4",
                )}
              >
                {visible.map((candle, index) => {
                  const highPct = ((candle.h - min) / span) * 100;
                  const lowPct = ((candle.l - min) / span) * 100;
                  const openPct = ((candle.o - min) / span) * 100;
                  const closePct = ((candle.c - min) / span) * 100;
                  const bull = candle.c >= candle.o;
                  const bodyTop = Math.max(openPct, closePct);
                  const bodyBottom = Math.min(openPct, closePct);
                  const bodyH = Math.max(bodyTop - bodyBottom, 0.8);
                  const wickH = Math.max(highPct - lowPct, 0.6);

                  return (
                    <div key={`${index}-${candle.c}`} className="relative h-full min-w-0 flex-1">
                      <span
                        className="absolute left-1/2 w-px -translate-x-1/2"
                        style={{
                          bottom: `${lowPct}%`,
                          height: `${wickH}%`,
                          background: bull ? "#10b981" : "#ef4444",
                        }}
                      />
                      <span
                        className="absolute left-1/2 w-[70%] max-w-[9px] -translate-x-1/2 rounded-[1px]"
                        style={{
                          bottom: `${bodyBottom}%`,
                          height: `${bodyH}%`,
                          background: bull ? "#10b981" : "#ef4444",
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {showVolume && (
                <div className="absolute inset-x-2 bottom-3 flex h-[22%] items-end gap-px border-t border-white/10 pt-2 pr-16">
                  {visible.map((candle, index) => {
                    const vol = candleVolume(candle);
                    const bull = candle.c >= candle.o;
                    const heightPct = (vol / volumeMax) * 100;
                    return (
                      <div key={`vol-${index}`} className="relative h-full min-w-0 flex-1">
                        <span
                          className="absolute bottom-0 left-1/2 w-[70%] max-w-[9px] -translate-x-1/2 rounded-[1px] opacity-70"
                          style={{
                            height: `${Math.max(heightPct, 4)}%`,
                            background: bull ? "#10b981" : "#ef4444",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <svg
                className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {hLines.map((price, index) => (
                  <line
                    key={`hline-${index}-${price}`}
                    x1="0"
                    y1={100 - ((price - min) / span) * 100}
                    x2="100"
                    y2={100 - ((price - min) / span) * 100}
                    stroke="#9514d1"
                    strokeWidth="0.35"
                    strokeDasharray="1.5 1"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {trendLines.map((line, index) => (
                  <line
                    key={`trend-${index}`}
                    x1={line.p1.xPct * 100}
                    y1={100 - line.p1.yPct * 100}
                    x2={line.p2.xPct * 100}
                    y2={100 - line.p2.yPct * 100}
                    stroke="#fbbf24"
                    strokeWidth="0.4"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {trendDraft && (
                  <circle
                    cx={trendDraft.xPct * 100}
                    cy={100 - trendDraft.yPct * 100}
                    r="0.8"
                    fill="#fbbf24"
                  />
                )}
                {[...drawPaths, ...(currentDraw ? [currentDraw] : [])].map((path, index) => (
                  <polyline
                    key={`draw-${index}`}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="0.45"
                    vectorEffect="non-scaling-stroke"
                    points={path.points
                      .map((pt) => `${pt.xPct * 100},${100 - pt.yPct * 100}`)
                      .join(" ")}
                  />
                ))}
              </svg>
            </div>

            <div className="absolute inset-y-3 right-2 z-10 flex flex-col justify-between text-right font-mono text-[10px] text-zinc-600">
              {labels.map((value) => (
                <span key={value}>{formatCompactUsd(value)}</span>
              ))}
            </div>

            {hLines.map((price, index) => (
              <div
                key={`hline-label-${index}`}
                className="pointer-events-none absolute right-16 z-10 font-mono text-[9px] text-[#9514d1]"
                style={{ bottom: priceToBottomPct(price) }}
              >
                {formatCompactUsd(price)}
              </div>
            ))}
          </>
        )}

        <div className="absolute bottom-2 left-3 z-10 flex items-center gap-0.5">
          {TOOLS.map((tool) => {
            const isActive =
              tool.id === "volume" ? showVolume : activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                aria-label={tool.label}
                aria-pressed={isActive}
                title={tool.label}
                onClick={() => selectTool(tool.id)}
                className={cn(
                  "rounded-md p-1.5 transition",
                  isActive
                    ? "bg-[#9514d1] text-white"
                    : "text-zinc-600 hover:bg-white/5 hover:text-foreground",
                )}
              >
                <tool.icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
