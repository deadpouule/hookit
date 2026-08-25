"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

import { formatUsd } from "@/lib/format";
import {
  type ChartTimeframe,
  formatPriceEth,
  generateChartSeries,
} from "@/lib/pools";
import { cn } from "@/lib/utils";

const TIMEFRAMES: ChartTimeframe[] = ["1H", "1D", "1W", "ALL"];

interface PriceChartProps {
  poolId: string;
  priceEth: number;
  marketCap: number;
  hookType: string;
  volume24h: number;
  liveSeries?: number[];
  liveFromPool?: boolean;
  priceLoading?: boolean;
}

function buildPath(values: number[], width: number, height: number, pad = 8): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || max * 0.01;

  return values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildArea(path: string, width: number, height: number): string {
  return `${path} L ${width - 8} ${height - 8} L 8 ${height - 8} Z`;
}

export function PriceChart({
  poolId,
  priceEth,
  marketCap,
  hookType,
  volume24h,
  liveSeries,
  liveFromPool,
  priceLoading,
}: PriceChartProps) {
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1D");

  const series = useMemo(() => {
    if (liveFromPool && liveSeries && liveSeries.length >= 2) {
      return liveSeries;
    }
    if (liveFromPool && priceEth > 0) {
      return [priceEth, priceEth];
    }
    return generateChartSeries(poolId, timeframe);
  }, [liveFromPool, liveSeries, priceEth, poolId, timeframe]);

  const width = 640;
  const height = 200;
  const linePath = buildPath(series, width, height);
  const areaPath = buildArea(linePath, width, height);

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-zinc-500">
            Price{liveFromPool ? " (live pool)" : ""}
          </p>
          <p className="mt-0.5 font-mono text-lg text-white sm:text-xl">
            {priceLoading && liveFromPool
              ? "Loading…"
              : formatPriceEth(priceEth)}
          </p>
        </div>
        {!liveFromPool && (
        <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-black/40 p-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-[11px] transition",
                timeframe === tf
                  ? "border border-white/20 bg-white/10 text-white"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              {tf}
            </button>
          ))}
        </div>
        )}
      </div>

      <motion.div
        key={timeframe}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="mt-6"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[180px] w-full sm:h-[220px]"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.12" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#chart-fill)" />
          <path
            d={linePath}
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </motion.div>

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-zinc-500">Market cap</p>
          <p className="mt-0.5 font-mono text-sm text-zinc-200">
            {liveFromPool
              ? `$${marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : marketCap >= 1_000_000
                ? `$${(marketCap / 1_000_000).toFixed(2)}M`
                : `$${(marketCap / 1_000).toFixed(0)}K`}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Category</p>
          <p className="mt-0.5 text-sm text-zinc-200">{hookType}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Volume 1D</p>
          <p className="mt-0.5 font-mono text-sm text-zinc-200">{formatUsd(volume24h)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Swap fee</p>
          <p className="mt-0.5 font-mono text-sm text-zinc-200">1%</p>
        </div>
      </div>
    </div>
  );
}
