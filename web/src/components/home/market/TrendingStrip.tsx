"use client";

import type { MarketToken } from "@/lib/market-tokens";
import type { MarketRankings } from "@/lib/market-rankings";
import { TRENDING_MAX } from "@/lib/market-rankings";
import { useIsMobile } from "@/hooks/useIsMobile";

import { TrendingTokenCard } from "./TrendingTokenCard";

type TrendingStripProps = {
  tokens: MarketToken[];
  rankings: MarketRankings;
};

const MOBILE_TRENDING_MAX = 4;

export function TrendingStrip({ tokens, rankings }: TrendingStripProps) {
  const isMobile = useIsMobile();
  const limit = isMobile ? MOBILE_TRENDING_MAX : TRENDING_MAX;
  const items = tokens.slice(0, limit);

  return (
    <div className="trending-strip no-scrollbar">
      {items.map((token) => (
        <TrendingTokenCard
          key={token.id}
          token={token}
          isTop={rankings.topIds.has(token.id)}
          isTrending={rankings.trendingIds.has(token.id)}
        />
      ))}
    </div>
  );
}
