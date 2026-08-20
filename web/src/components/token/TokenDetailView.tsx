"use client";

import Link from "next/link";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

import { PriceChart } from "@/components/token/PriceChart";
import { SwapPanel } from "@/components/token/SwapPanel";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getPoolById } from "@/lib/pools";
import type { TokenPool } from "@/lib/types";
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
      <span className="text-2xl font-bold text-white/90 sm:text-3xl">{pool.ticker[0]}</span>
    </div>
  );
}

export function TokenDetailView({ pool }: TokenDetailViewProps) {
  const [copied, setCopied] = useState(false);
  const enriched = getPoolById(pool.id)!;
  const fullAddress = enriched.contractAddress ?? pool.address;

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
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-600 transition hover:text-zinc-400"
                aria-label="X profile"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="mt-2 font-mono text-xs text-zinc-600">
              ${pool.quoteAsset ?? "ETH"}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {pool.hooks.backedFloor && (
                <HookPill label="Backed Floor" />
              )}
              {pool.hooks.antiSnipe && <HookPill label="Anti-Snipe" />}
              {pool.hooks.antiMev && <HookPill label="Anti-MEV" />}
              {pool.hooks.customHook && (
                <HookPill label="Custom Hook" variant="warn" />
              )}
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:gap-5">
          <PriceChart
            poolId={pool.id}
            priceEth={enriched.priceEth ?? 1e-9}
            marketCap={pool.marketCap}
            hookType={pool.hookType}
            volume24h={enriched.volume24h ?? pool.liquidity * 0.15}
          />
          <SwapPanel pool={pool} />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

function HookPill({ label, variant }: { label: string; variant?: "warn" }) {
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        variant === "warn"
          ? "border-amber-500/25 text-amber-400/90"
          : "border-white/10 text-zinc-500",
      )}
    >
      {label}
    </span>
  );
}
