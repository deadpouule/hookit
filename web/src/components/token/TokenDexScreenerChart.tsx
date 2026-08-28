"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { useDexScreenerChart } from "@/hooks/useDexScreenerChart";
import {
  buildDexScreenerChartTarget,
  getDexScreenerChainSlug,
  normalizeTokenAddress,
} from "@/lib/dexscreener";
import { cn } from "@/lib/utils";

type TokenDexScreenerChartProps = {
  tokenAddress: string;
  className?: string;
};

export function TokenDexScreenerChart({ tokenAddress, className }: TokenDexScreenerChartProps) {
  const normalized = normalizeTokenAddress(tokenAddress);
  const { data, isError } = useDexScreenerChart(normalized ?? undefined);
  const [frameLoaded, setFrameLoaded] = useState(false);

  const fallbackChart = normalized
    ? buildDexScreenerChartTarget(normalized, null, getDexScreenerChainSlug())
    : null;
  const chart = data ?? fallbackChart;
  const pageUrl = chart?.pageUrl;
  const embedUrl = chart?.embedUrl;
  const indexed = !!chart?.pair;

  return (
    <div className={cn("desk-card overflow-hidden", className)}>
      <div className="relative h-[340px] bg-[#0a0a0a] sm:h-[420px]">
        {!normalized ? (
          <ChartMessage message="Invalid token address" />
        ) : isError || !embedUrl || !pageUrl ? (
          <ChartMessage
            message="DexScreener chart unavailable"
            actionHref={normalized ? `https://dexscreener.com/search?q=${normalized}` : undefined}
            actionLabel="Search on DexScreener"
          />
        ) : (
          <>
            {!frameLoaded && (
              <ChartMessage
                message={indexed ? "Loading chart…" : "Waiting for DexScreener to index this pool…"}
                actionHref={pageUrl}
                actionLabel="Open on DexScreener"
              />
            )}
            <iframe
              key={embedUrl}
              src={embedUrl}
              title={`DexScreener chart for ${normalized}`}
              loading="lazy"
              allow="clipboard-write"
              className={cn(
                "absolute inset-0 h-full w-full border-0",
                frameLoaded ? "opacity-100" : "opacity-0",
              )}
              onLoad={() => setFrameLoaded(true)}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ChartMessage({
  message,
  actionHref,
  actionLabel,
}: {
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-zinc-500">{message}</p>
      {actionHref && actionLabel ? (
        <a
          href={actionHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-[#9514d1] hover:text-white"
        >
          {actionLabel}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}
