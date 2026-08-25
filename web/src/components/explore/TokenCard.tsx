"use client";

import Link from "next/link";
import { Check, Code2, Copy, Shield } from "lucide-react";
import { useState } from "react";

import { DEFAULT_LAUNCH_ETH_USD, TARGET_LAUNCH_MCAP_USD } from "@/lib/constants";
import { formatPercent, formatUsd, shortenAddress } from "@/lib/format";
import { marketCapUsd } from "@/lib/pool-price";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUICK_BUY_AMOUNTS = [10, 25, 50, 100] as const;

interface TokenCardProps {
  pool: TokenPool;
}

export function TokenCard({ pool }: TokenCardProps) {
  const [copied, setCopied] = useState(false);
  const fullAddress = pool.contractAddress ?? pool.id;

  const displayMcap =
    pool.marketCap > 0
      ? pool.marketCap
      : pool.priceEth && pool.priceEth > 0
        ? marketCapUsd(pool.priceEth, DEFAULT_LAUNCH_ETH_USD)
        : TARGET_LAUNCH_MCAP_USD;

  const volume = pool.volume24h ?? 0;
  const earnings = pool.earnings ?? 0;

  const creatorLabel = pool.creator
    ? shortenAddress(pool.creator)
    : pool.address.includes("...")
      ? pool.address
      : shortenAddress(pool.address);

  const changePositive = pool.change24h >= 0;

  const copyTicker = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(fullAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article className="explore-token-card group">
      <Link href={`/explore/${pool.id}`} className="block">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div
              className="explore-token-avatar"
              style={{ background: pool.bannerGradient }}
            >
              {pool.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pool.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-white/90">{pool.ticker[0]}</span>
              )}
            </div>
            <span
              className={cn(
                "explore-token-badge",
                pool.hookType === "Custom"
                  ? "bg-lime-400 text-black"
                  : "bg-sky-500 text-white",
              )}
            >
              {pool.hookType === "Custom" ? (
                <Code2 className="h-2.5 w-2.5" />
              ) : (
                <Shield className="h-2.5 w-2.5" />
              )}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-semibold text-white">{pool.name}</h3>
                <button
                  type="button"
                  onClick={copyTicker}
                  className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-zinc-500 transition hover:text-zinc-300"
                >
                  ${pool.ticker}
                  {copied ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3 opacity-50" />
                  )}
                </button>
              </div>
              <p
                className={cn(
                  "shrink-0 font-mono text-sm font-semibold tabular-nums",
                  changePositive ? "text-emerald-400" : "text-red-400",
                )}
              >
                {formatPercent(pool.change24h, true)}
              </p>
            </div>
          </div>
        </div>

        <dl className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5">
          <Stat label="Market Cap" value={formatUsd(displayMcap)} />
          <Stat label="Volume" value={volume > 0 ? formatUsd(volume) : "—"} />
          <Stat label="Creator" value={creatorLabel} mono />
          <Stat label="Earnings" value={earnings > 0 ? formatUsd(earnings) : "—"} />
        </dl>
      </Link>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {QUICK_BUY_AMOUNTS.map((amount) => (
          <Link
            key={amount}
            href={`/explore/${pool.id}?buy=${amount}`}
            className="explore-quick-buy"
          >
            ${amount}
          </Link>
        ))}
      </div>
    </article>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-zinc-500">{label}</dt>
      <dd className={cn("mt-0.5 text-sm font-semibold text-zinc-100", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}
