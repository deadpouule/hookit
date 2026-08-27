"use client";

import { BarChart3, Crosshair, Minus, Pencil, TrendingUp } from "lucide-react";
import { useMemo } from "react";

import { formatCompactUsd } from "@/lib/format";
import type { LiveCandle } from "@/lib/token-live";
import { cn } from "@/lib/utils";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"] as const;
export type ChartInterval = (typeof TIMEFRAMES)[number];

const VISIBLE: Record<ChartInterval, number> = {
  "1m": 64,
  "5m": 48,
  "15m": 36,
  "1h": 28,
  "4h": 20,
  "1D": 14,
};

const TOOLS = [
  { id: "cursor", icon: Crosshair, label: "Cursor" },
  { id: "trend", icon: TrendingUp, label: "Trend" },
  { id: "line", icon: Minus, label: "Line" },
  { id: "draw", icon: Pencil, label: "Draw" },
  { id: "volume", icon: BarChart3, label: "Volume" },
] as const;

export function TokenCandleChart({
  candles,
  interval,
  onInterval,
}: {
  candles: LiveCandle[];
  interval: ChartInterval;
  onInterval: (next: ChartInterval) => void;
}) {
  const visible = useMemo(() => candles.slice(-VISIBLE[interval]), [candles, interval]);
  const min = Math.min(...visible.map((c) => c.l));
  const max = Math.max(...visible.map((c) => c.h));
  const span = Math.max(max - min, 1);
  const labels = [max, min + span * 0.66, min + span * 0.33, min];

  return (
    <div className="desk-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
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
                  : "text-zinc-500 hover:text-white",
              )}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              aria-label={tool.label}
              className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-[#03b1ed]"
            >
              <tool.icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-[340px] bg-[#0a0a0a] sm:h-[420px]">
        <div className="candle-grid absolute inset-0" />
        <div className="absolute inset-y-3 right-2 z-10 flex flex-col justify-between text-right font-mono text-[10px] text-zinc-600">
          {labels.map((value) => (
            <span key={value}>{formatCompactUsd(value)}</span>
          ))}
        </div>
        <div className="relative z-[1] flex h-full items-end gap-px px-2 py-4 pr-16">
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
      </div>
    </div>
  );
}
