"use client";

import Link from "next/link";
import { ArrowLeft, Copy, ExternalLink, Layers } from "lucide-react";
import { useState } from "react";

import { PriceChart } from "@/components/token/PriceChart";
import { SwapPanel } from "@/components/token/SwapPanel";
import { CreatorActions } from "@/components/token/CreatorActions";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { usePoolSpotPrice, usePriceHistory } from "@/hooks/usePoolPrice";
import { marketCapUsd } from "@/lib/pool-price";
import { getPoolById } from "@/lib/pools";
import { getBlockExplorerUrl } from "@/lib/chains";
import { DEFAULT_LAUNCH_ETH_USD, TARGET_LAUNCH_MCAP_USD } from "@/lib/constants";
import type { TokenPool } from "@/lib/types";
import { accentForTag } from "@/lib/hook-modules";
import { cn } from "@/lib/utils";

interface TokenDetailViewProps {
  pool: TokenPool;
}

function TokenAvatar({ pool }: { pool: TokenPool }) {
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 sm:h-20 sm:w-20"
      style={{ background: pool.bannerGradient }}
    >
      {pool.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pool.image} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-2xl font-bold text-white/90 sm:text-3xl">{pool.ticker[0]}</span>
      )}
    </div>
  );
}

export function TokenDetailView({ pool }: TokenDetailViewProps) {
  const [copied, setCopied] = useState(false);
  const enriched = getPoolById(pool.id) ?? pool;
  const fullAddress = pool.contractAddress ?? enriched.contractAddress ?? pool.address;
  const { data: spotPrice, isLoading: priceLoading } = usePoolSpotPrice(pool.poolId);
  const priceHistory = usePriceHistory(pool.poolId, spotPrice);
  const liveSeries =
    pool.priceSeries && pool.priceSeries.length >= 2
      ? pool.priceSeries
      : priceHistory.map((p) => p.priceEth);
  const priceEth = spotPrice ?? enriched.priceEth ?? 0;
  const marketCap = pool.poolId
    ? marketCapUsd(priceEth, DEFAULT_LAUNCH_ETH_USD)
    : pool.marketCap || TARGET_LAUNCH_MCAP_USD;

  const copyAddress = async () => {
    await navigator.clipboard.writeText(fullAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="page-shell py-6 sm:py-8">
        <Link
          href="/explore"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Explore
        </Link>

        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <TokenAvatar pool={pool} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm text-zinc-500">${pool.ticker}</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {pool.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyAddress}
                className="flex items-center gap-1.5 font-mono text-xs text-zinc-500 transition hover:text-zinc-300"
              >
                {pool.address}
                <Copy className="h-3 w-3" />
                {copied && <span className="text-emerald-500">Copied</span>}
              </button>
              <a
                href={`${getBlockExplorerUrl()}/address/${fullAddress}#code`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-zinc-600 transition hover:text-zinc-400"
                aria-label="View contract source on Basescan"
              >
                Source
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="mt-2 font-mono text-xs text-zinc-600">
              ${pool.quoteAsset ?? "ETH"}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {pool.hooks.backedFloor && <HookPill label="Backed Floor" />}
              {pool.hooks.antiSnipe && <HookPill label="Anti-Snipe" />}
              {pool.hooks.antiMev && <HookPill label="Anti-MEV" />}
              {pool.hooks.autoBurn && <HookPill label="Auto Burn" />}
              {pool.hooks.lpDonate && <HookPill label="LP Donate" />}
              {pool.hooks.customHook && <HookPill label="Custom Solidity" variant="warn" />}
              <HookPill label={pool.hookType} variant={pool.hookType === "Custom" ? "warn" : undefined} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto lg:min-w-[280px]">
            <StatBox label="FDV" value={`$${marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
            <StatBox label="Quote" value={pool.quoteAsset ?? "ETH"} />
            <StatBox label="Hook" value={pool.hookType} />
            <StatBox
              label="Pool"
              value={pool.poolId ? "Live" : "—"}
              accent={!!pool.poolId}
            />
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:gap-5">
          <PriceChart
            poolId={pool.id}
            priceEth={priceEth}
            marketCap={marketCap}
            hookType={pool.hookType}
            volume24h={pool.volume24h ?? 0}
            liveSeries={liveSeries}
            liveFromPool={!!pool.poolId}
            priceLoading={priceLoading}
          />
          <div className="space-y-4">
            <SwapPanel pool={pool} />
            <CreatorActions pool={pool} />
          </div>
        </div>

        {pool.poolId && (
          <div className="mt-6 panel-inset flex flex-wrap items-center gap-3 px-4 py-3 text-xs text-zinc-500">
            <Layers className="h-3.5 w-3.5 text-zinc-600" />
            <span className="font-mono text-zinc-400">poolId</span>
            <span className="truncate font-mono text-zinc-600">{pool.poolId}</span>
            <a
              href={`${getBlockExplorerUrl()}/address/${fullAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
            >
              View contract <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
      <SiteFooter />
    </>
  );
}

function HookPill({ label, variant }: { label: string; variant?: "warn" }) {
  const accent = accentForTag(label);
  if (variant === "warn") {
    return (
      <span className="rounded-md border border-amber-500/25 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400/90">
        {label}
      </span>
    );
  }
  return (
    <span
      className="rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
      style={{
        borderColor: `${accent.color}40`,
        color: accent.color,
        background: `${accent.color}12`,
      }}
    >
      {label}
    </span>
  );
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="panel-inset px-3 py-2.5">
      <p className="text-[10px] text-zinc-600 uppercase">{label}</p>
      <p className={cn("mt-0.5 font-mono text-sm", accent ? "text-emerald-400" : "text-zinc-200")}>
        {value}
      </p>
    </div>
  );
}
