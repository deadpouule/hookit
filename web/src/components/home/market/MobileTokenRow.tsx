"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatPercent, formatUsd } from "@/lib/format";
import type { MarketToken } from "@/lib/market-tokens";
import { TOTAL_SUPPLY } from "@/lib/token-live";
import { tokenHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { TokenArt } from "./TokenArt";
import { TokenCopyBadge } from "./TokenBadges";

function formatSpotUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(3)}`;
}

export function MobileTokenRow({ token }: { token: MarketToken }) {
  const router = useRouter();
  const href = tokenHref(token.id);
  const spot = token.marketCap > 0 ? token.marketCap / TOTAL_SUPPLY : 0;
  const up = token.change24h >= 0;
  const pair = token.pairings?.[0]?.name ?? token.quoteAsset ?? "ETH";

  return (
    <article
      className="mobile-token-row"
      onClick={() => router.push(href)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
    >
      <div className="relative shrink-0">
        <TokenArt
          token={token}
          className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full"
          glyphClassName="text-lg"
        />
        <TokenCopyBadge token={token} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-white">{token.name}</p>
        <p className="mt-0.5 truncate font-mono text-[12px] text-zinc-500">
          ${token.ticker}
          <span className="mx-1.5 text-zinc-700">·</span>
          <span className="stonk-pair-pill">{pair}</span>
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">
          MC <span className="text-zinc-300">{formatUsd(token.marketCap)}</span>
          <span className="mx-1.5 text-zinc-700">·</span>
          Vol <span className="text-zinc-300">{formatUsd(token.volume)}</span>
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-mono text-sm font-medium text-white">
          {formatSpotUsd(spot)}
        </p>
        <p className={cn("mt-0.5 text-[12px] font-medium", up ? "text-emerald-400" : "text-rose-400")}>
          {up ? "▲" : "▼"} {formatPercent(Math.abs(token.change24h))}
        </p>
      </div>

      <Link href={href} className="absolute inset-0 z-0" aria-label={`${token.name} $${token.ticker}`}>
        <span className="sr-only">
          {token.name} ${token.ticker}
        </span>
      </Link>
    </article>
  );
}
