"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Code2, Copy, Shield } from "lucide-react";
import { useState } from "react";

import { HookChip } from "@/components/hooks/HookMark";
import { copyToClipboard } from "@/lib/clipboard";
import { DEFAULT_LAUNCH_ETH_USD, TARGET_LAUNCH_MCAP_USD } from "@/lib/constants";
import { formatUsd } from "@/lib/format";
import { marketCapUsd } from "@/lib/pool-price";
import { tokenHref } from "@/lib/routes";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TokenCardProps {
  pool: TokenPool;
}

export function TokenCard({ pool }: TokenCardProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const fullAddress = pool.contractAddress ?? pool.id;
  const displayMcap =
    pool.marketCap > 0
      ? pool.marketCap
      : pool.priceEth && pool.priceEth > 0
        ? marketCapUsd(pool.priceEth, DEFAULT_LAUNCH_ETH_USD)
        : TARGET_LAUNCH_MCAP_USD;

  const copyAddress = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!(await copyToClipboard(fullAddress))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.article
      layout
      initial={false}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="market-card group relative cursor-pointer overflow-hidden border border-transparent transition-all duration-300 hover:border-[#9514d1] hover:shadow-[0_0_15px_rgba(149,20,209,0.5)]"
      onClick={() => router.push(tokenHref(pool.id))}
    >
      <div
        className="pointer-events-none flex aspect-square items-center justify-center overflow-hidden"
        style={{ background: pool.bannerGradient }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#141416] via-black/10 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span
            className={cn(
              "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm",
              pool.hookType === "Custom"
                ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                : "border-white/15 bg-black/40 text-zinc-300",
            )}
          >
            {pool.hookType === "Custom" ? (
              <span className="inline-flex items-center gap-1">
                <Code2 className="h-3 w-3" />
                Custom
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Master
              </span>
            )}
          </span>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl font-bold text-white/25 transition group-hover:text-white/40">
            {pool.ticker[0]}
          </span>
        </div>
        <div className="absolute top-3 right-3 opacity-0 transition group-hover:opacity-100">
          <ArrowUpRight className="h-4 w-4 text-white/70" />
        </div>
      </div>

      <div className="pointer-events-none px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-medium text-zinc-100">{pool.name}</h3>
            <p className="mt-0.5 font-mono text-xs text-zinc-500">${pool.ticker}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-600 uppercase">FDV</p>
            <p className="font-mono text-sm text-zinc-200">{formatUsd(displayMcap)}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {pool.hooks.antiSnipe && <HookChip id="antiSnipe" />}
          {pool.hooks.backedFloor && <HookChip id="backedFloor" />}
          {pool.hooks.antiMev && <HookChip id="antiMev" />}
          {pool.hooks.holderAirdrop && <HookChip id="holderAirdrop" />}
          {pool.hooks.customHook && <HookChip id="custom" />}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.06] bg-black/20 px-4 py-2.5">
        <button
          type="button"
          onClick={copyAddress}
          className="relative z-20 flex items-center gap-1.5 font-mono text-[11px] text-zinc-500 transition hover:text-zinc-300"
        >
          {pool.address}
          {copied ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3 opacity-60" />
          )}
        </button>
        <span className="pointer-events-none text-[10px] text-zinc-600">{pool.quoteAsset ?? "ETH"}</span>
      </div>
      <Link
        href={tokenHref(pool.id)}
        className="absolute inset-0 z-10"
        aria-label={`${pool.name} $${pool.ticker}`}
      >
        <span className="sr-only">
          {pool.name} ${pool.ticker}
        </span>
      </Link>
    </motion.article>
  );
}
