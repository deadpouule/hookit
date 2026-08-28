"use client";

import Link from "next/link";
import { Flame, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";

import { formatPercent } from "@/lib/format";
import type { MarketToken } from "@/lib/market-tokens";
import { tokenHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { TokenArt } from "./TokenArt";

export function TrendingTokenCard({ token }: { token: MarketToken }) {
  const router = useRouter();
  const href = tokenHref(token.id);
  const positive = token.change1h >= 0;

  return (
    <article
      className="trending-card group relative shrink-0 cursor-pointer"
      onClick={() => router.push(href)}
    >
      <span
        className={cn(
          "trending-card-pct",
          positive ? "trending-card-pct--up" : "trending-card-pct--down",
        )}
      >
        {formatPercent(token.change1h, true)}
      </span>

      <div className="trending-card-inner">
        <TokenArt
          token={token}
          className="trending-card-avatar"
          glyphClassName="text-xl"
        />

        <div className="trending-card-text">
          <div className="trending-card-name-row">
            <p className="trending-card-name">{token.name}</p>
            <Flame className="trending-card-flame" aria-hidden />
            <Trophy className="trending-card-trophy" aria-hidden />
          </div>
          <p className="trending-card-ticker">
            <span className="trending-card-ticker-emoji" aria-hidden>
              {token.emoji}
            </span>
            ${token.ticker}
          </p>
        </div>
      </div>

      <Link
        href={href}
        className="absolute inset-0 z-10"
        aria-label={`${token.name} $${token.ticker}`}
      >
        <span className="sr-only">
          {token.name} ${token.ticker}
        </span>
      </Link>
    </article>
  );
}
