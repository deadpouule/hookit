"use client";

import Link from "next/link";
import { Flame, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";

import { HookitLogo } from "@/components/brand/HookitLogo";
import { formatPercent } from "@/lib/format";
import type { MarketToken } from "@/lib/market-tokens";
import { tokenHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { CopyContractButton } from "./CopyContractButton";
import { HookAvatarBadge } from "./HookAvatarBadge";
import { TokenArt } from "./TokenArt";

type TrendingTokenCardProps = {
  token: MarketToken;
  isTop: boolean;
  isTrending: boolean;
};

export function TrendingTokenCard({ token, isTop, isTrending }: TrendingTokenCardProps) {
  const router = useRouter();
  const href = tokenHref(token.id);
  const positive = token.change1h >= 0;

  return (
    <article
      className="trending-card group relative cursor-pointer"
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
        <div className="trending-card-avatar-wrap">
          <TokenArt
            token={token}
            className="trending-card-avatar"
            glyphClassName="text-base"
          />
          <HookAvatarBadge />
        </div>

        <div className="trending-card-text">
          <div className="trending-card-name-row">
            <p className="trending-card-name">{token.name}</p>
            {isTrending && (
              <span title="Trending">
                <Flame className="trending-card-flame" aria-label="Trending" />
              </span>
            )}
            {isTop && (
              <span title="Top market cap">
                <Trophy className="trending-card-trophy" aria-label="Top" />
              </span>
            )}
          </div>
          <div className="trending-card-ticker-row">
            <p className="trending-card-ticker">
              <HookitLogo size="xs" className="trending-card-brand-logo" />
              ${token.ticker}
            </p>
            <CopyContractButton token={token} />
          </div>
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
