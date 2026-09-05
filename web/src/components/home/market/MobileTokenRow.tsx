"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { HookitLogo } from "@/components/brand/HookitLogo";
import { formatCompactUsd, formatPercent, formatUsd } from "@/lib/format";
import type { MarketToken } from "@/lib/market-tokens";
import { TOTAL_SUPPLY } from "@/lib/token-live";
import { tokenHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { QuickBuy } from "./QuickBuy";
import { TokenArt } from "./TokenArt";
import { TokenCopyBadge } from "./TokenBadges";

/** Compact explore row for mobile — replaces wide table columns. */
export function MobileTokenRow({ token }: { token: MarketToken }) {
  const router = useRouter();
  const href = tokenHref(token.id);
  const spot = token.marketCap > 0 ? token.marketCap / TOTAL_SUPPLY : 0;
  const up = token.change24h >= 0;

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
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          glyphClassName="text-lg"
        />
        <TokenCopyBadge token={token} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{token.name}</p>
            <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-zinc-500">
              <HookitLogo size="xs" />
              ${token.ticker}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-sm text-white">
              {spot > 0 ? formatCompactUsd(spot) : "—"}
            </p>
            <span
              className={cn(
                "mt-0.5 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
              )}
            >
              {formatPercent(token.change24h, true)}
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-zinc-500">
            FDV <span className="text-zinc-300">{formatUsd(token.marketCap)}</span>
          </p>
          <QuickBuy tokenId={token.id} size="sm" className="pointer-events-auto relative z-10" />
        </div>
      </div>

      <Link href={href} className="absolute inset-0 z-0" aria-label={`${token.name} $${token.ticker}`}>
        <span className="sr-only">
          {token.name} ${token.ticker}
        </span>
      </Link>
    </article>
  );
}
